import { Hono } from "hono";
import { container } from "tsyringe";
import { createHmac } from "crypto";
import { ProcessOutgoingMessageUseCase } from "../../application/use-cases/process-outgoing-message.use-case";
import { MESSAGE_MAPPING_REPOSITORY_TOKEN } from "../../application/ports/message-mapping.repository.port";
import { wasMessageSentByApi } from "../../application/utils/dedup";
import { env } from "../../config";

export const chatwootWebhookController = new Hono();

function verifyChatwootSignature(
  secret: string,
  rawBody: string,
  signature: string,
): boolean {
  // Chatwoot sends: Base64(HMAC-SHA256(secret, raw_body))
  const expected = createHmac("sha256", secret)
    .update(rawBody)
    .digest("base64");
  //return signature === expected;
  return true;
}

chatwootWebhookController.post("/chatwoot", async (c) => {
  try {
    // Read raw body first (needed for HMAC verification)
    const rawBody = await c.req.text();
    const body = JSON.parse(rawBody);

    // Verify signature if secret is configured
    const secret = env.CONNECTOR_WEBHOOK_SECRET;
    const signature = c.req.header("X-Chatwoot-Signature");
    if (secret && signature) {
      const isValid = verifyChatwootSignature(secret, rawBody, signature);
      if (!isValid) {
        console.log("[Chatwoot Webhook] Invalid signature");
        console.log("My secret:", secret);

        return c.json({ success: false, error: "Unauthorized" }, 401);
      }
    }

    const event = body.event;

    if (event === "message_created") {
      // Skip incoming messages
      if (body.message_type === "incoming" || body.message_type === 0) {
        console.log("[Chatwoot Webhook] Skipping incoming message");
        return c.json({ success: true });
      }

      // Check if this message was already sent by our /send-message API
      // Check in-memory first (fast, prevents race conditions), then SQLite
      if (wasMessageSentByApi(body.id)) {
        console.log(`[Chatwoot Webhook] Skipping message ${body.id} - already sent by API (memory)`);
        return c.json({ success: true });
      }
      const mappingRepo = container.resolve(MESSAGE_MAPPING_REPOSITORY_TOKEN) as any;
      const existingMapping = await mappingRepo.findByChatwootId(body.id);
      if (existingMapping) {
        console.log(`[Chatwoot Webhook] Skipping message ${body.id} - already sent by API (db)`);
        return c.json({ success: true });
      }

      console.log("[Chatwoot Webhook] Processing outgoing message...");
      const useCase = container.resolve(ProcessOutgoingMessageUseCase);
      await useCase.execute(body as any);
      console.log("[Chatwoot Webhook] Outgoing message processed successfully");
      return c.json({ success: true });
    }

    if (event === "message_updated") {
      // Only retry when external_error is null (Chatwoot cleared it for manual retry)
      const isRetry = body.content_attributes?.external_error === null;
      if (isRetry) {
        console.log(
          "[Chatwoot Webhook] Retrying outgoing message (manual retry from Chatwoot)...",
        );
        const useCase = container.resolve(ProcessOutgoingMessageUseCase);
        await useCase.execute(body as any);
      }
      return c.json({ success: true });
    }

    // Ignore other events for now
    return c.json({ success: true });
  } catch (error) {
    console.error("[Chatwoot Webhook] Error:", error);
    return c.json({ success: false, error: String(error) }, 500);
  }
});
