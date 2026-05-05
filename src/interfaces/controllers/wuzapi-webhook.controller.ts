import { Hono } from "hono";
import { container } from "tsyringe";
import { ProcessIncomingMessageUseCase } from "../../application/use-cases/process-incoming-message.use-case";
import { wuzapiWebhookSchema } from "./schemas";
import { validateBody } from "../middleware/validation";

export const wuzapiWebhookController = new Hono();

wuzapiWebhookController.post("/wuzapi", validateBody(wuzapiWebhookSchema), async (c) => {
  try {
    const body = c.get("validatedBody") as {
      type: string;
      event?: unknown;
      userID?: string;
      instanceName?: string;
      jsonData?: string;
    };

    // Wuzapi sends webhooks with jsonData field containing the actual payload
    let payload = body as Record<string, unknown>;
    if (body.jsonData) {
      try {
        const parsed = JSON.parse(body.jsonData);
        payload = { ...parsed, userID: body.userID, instanceName: body.instanceName };
      } catch {
        // If jsonData is not valid JSON, use body as-is
      }
    }

    const type = payload.type;

    if (type === "Message") {
      const useCase = container.resolve(ProcessIncomingMessageUseCase);
      await useCase.execute(payload as any);
      return c.json({ success: true });
    }

    if (type === "ReadReceipt") {
      console.log("[Wuzapi Webhook] ReadReceipt received:", (payload as any).state);
      return c.json({ success: true });
    }

    // Ignore other event types for now
    return c.json({ success: true });
  } catch (error) {
    console.error("[Wuzapi Webhook] Error:", error);
    return c.json({ success: false, error: String(error) }, 500);
  }
});
