import { Hono } from "hono";
import { container } from "tsyringe";
import { SendMessageUseCase } from "../../application/use-cases/send-message.use-case";

export const sendMessageController = new Hono();

sendMessageController.post("/send-message", async (c) => {
  try {
    const body = await c.req.json();

    const requiredFields = ["phone", "conversationId", "type", "content"];
    for (const field of requiredFields) {
      if (!(field in body)) {
        return c.json({ success: false, error: `Missing required field: ${field}` }, 400);
      }
    }

    const useCase = container.resolve(SendMessageUseCase);
    const result = await useCase.execute(body);

    return c.json({ success: true, data: result });
  } catch (error) {
    console.error("[SendMessage] Error:", error);
    return c.json({ success: false, error: String(error) }, 500);
  }
});
