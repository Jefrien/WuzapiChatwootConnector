import { Hono } from "hono";
import { container } from "tsyringe";
import { ProcessOutgoingMessageUseCase } from "../../application/use-cases/process-outgoing-message.use-case";
import { env } from "../../config";

export const chatwootWebhookController = new Hono();

chatwootWebhookController.post("/chatwoot", async (c) => {
  console.log("[Chatwoot Webhook] ===== HANDLER STARTED =====");
  try {
    console.log("[Chatwoot Webhook] Parsing JSON body...");
    const body = await c.req.json();
    console.log("[Chatwoot Webhook] JSON parsed. Event:", body?.event, "message_type:", body?.message_type);

    // Verify secret if configured
    const secret = c.req.header("X-Chatwoot-Signature");
    console.log("[Chatwoot Webhook] Secret header:", secret ? "present" : "missing");
    if (env.CONNECTOR_WEBHOOK_SECRET && secret !== env.CONNECTOR_WEBHOOK_SECRET) {
      console.log("[Chatwoot Webhook] Unauthorized - secret mismatch");
      return c.json({ success: false, error: "Unauthorized" }, 401);
    }

    const event = body.event;
    console.log("[Chatwoot Webhook] Event extracted:", event);

    if (event === "message_created") {
      console.log("[Chatwoot Webhook] Branch: message_created");
      if (body.message_type === "incoming" || body.message_type === 0) {
        console.log("[Chatwoot Webhook] Skipping incoming message");
        return c.json({ success: true });
      }

      console.log("[Chatwoot Webhook] Processing outgoing message...");
      const useCase = container.resolve(ProcessOutgoingMessageUseCase);
      console.log("[Chatwoot Webhook] UseCase resolved, executing...");
      await useCase.execute(body as any);
      console.log("[Chatwoot Webhook] Outgoing message processed successfully");
      return c.json({ success: true });
    }

    if (event === "message_updated") {
      console.log("[Chatwoot Webhook] Branch: message_updated");
      const isRetry = body.content_attributes?.external_error === null;
      console.log("[Chatwoot Webhook] Is retry:", isRetry, "external_error:", body.content_attributes?.external_error);
      if (isRetry) {
        console.log("[Chatwoot Webhook] Retrying outgoing message (manual retry from Chatwoot)...");
        const useCase = container.resolve(ProcessOutgoingMessageUseCase);
        await useCase.execute(body as any);
      } else {
        console.log("[Chatwoot Webhook] Ignoring message_updated");
      }
      return c.json({ success: true });
    }

    console.log("[Chatwoot Webhook] Unknown event, ignoring:", event);
    return c.json({ success: true });
  } catch (error) {
    console.error("[Chatwoot Webhook] ===== ERROR =====", error);
    return c.json({ success: false, error: String(error) }, 500);
  }
});
