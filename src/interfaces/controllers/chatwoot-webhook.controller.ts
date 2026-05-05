import { Hono } from "hono";
import { container } from "tsyringe";
import { ProcessOutgoingMessageUseCase } from "../../application/use-cases/process-outgoing-message.use-case";
import { chatwootWebhookSchema } from "./schemas";
import { validateBody } from "../middleware/validation";
import { env } from "../../config";

export const chatwootWebhookController = new Hono();

chatwootWebhookController.post("/chatwoot", async (c) => {
  try {
    const body = await c.req.json();
    console.log("[Chatwoot Webhook] Raw body:", JSON.stringify(body, null, 2));

    // Verify secret if configured
    const secret = c.req.header("X-Chatwoot-Signature");
    if (env.CONNECTOR_WEBHOOK_SECRET && secret !== env.CONNECTOR_WEBHOOK_SECRET) {
      return c.json({ success: false, error: "Unauthorized" }, 401);
    }

    const event = body.event;

    if (event === "message_created") {
      // Skip incoming messages
      if (body.message_type === "incoming" || body.message_type === 0) {
        console.log("[Chatwoot Webhook] Skipping incoming message");
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
        console.log("[Chatwoot Webhook] Retrying outgoing message (manual retry from Chatwoot)...");
        const useCase = container.resolve(ProcessOutgoingMessageUseCase);
        await useCase.execute(body as any);
      } else {
        console.log("[Chatwoot Webhook] Ignoring message_updated, external_error:", body.content_attributes?.external_error);
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
