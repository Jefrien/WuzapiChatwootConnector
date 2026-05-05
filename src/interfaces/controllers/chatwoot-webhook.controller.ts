import { Hono } from "hono";
import { container } from "tsyringe";
import { ProcessOutgoingMessageUseCase } from "../../application/use-cases/process-outgoing-message.use-case";
import { chatwootWebhookSchema } from "./schemas";
import { validateBody } from "../middleware/validation";
import { env } from "../../config";

export const chatwootWebhookController = new Hono();

chatwootWebhookController.post("/chatwoot", validateBody(chatwootWebhookSchema), async (c) => {
  try {
    const body = c.get("validatedBody") as {
      event: string;
      message_type?: "incoming" | "outgoing" | "activity";
      id?: number;
      content?: string;
      content_type?: string;
      private?: boolean;
      conversation?: any;
      sender?: any;
      attachments?: any[];
      content_attributes?: Record<string, unknown>;
    };

    // Verify secret if configured
    const secret = c.req.header("X-Chatwoot-Signature");
    if (env.CONNECTOR_WEBHOOK_SECRET && secret !== env.CONNECTOR_WEBHOOK_SECRET) {
      return c.json({ success: false, error: "Unauthorized" }, 401);
    }

    const event = body.event;

    if (event === "message_created") {
      const useCase = container.resolve(ProcessOutgoingMessageUseCase);
      await useCase.execute(body as any);
      return c.json({ success: true });
    }

    if (event === "message_updated") {
      // Handle retries or status updates if needed
      const isRetry =
        body.content_attributes?.external_error === null ||
        Boolean(body.content_attributes?.external_error);
      if (isRetry) {
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
