import { Hono } from "hono";
import { container } from "tsyringe";
import { CHATWOOT_CLIENT_TOKEN } from "../../application/ports/chatwoot-client.port";

export const messagesController = new Hono();

messagesController.get("/conversations/:accountId/:conversationId/messages", async (c) => {
  try {
    const accountId = Number(c.req.param("accountId"));
    const conversationId = Number(c.req.param("conversationId"));
    const before = c.req.query("before");

    if (isNaN(accountId) || isNaN(conversationId)) {
      return c.json({ success: false, error: "Invalid accountId or conversationId" }, 400);
    }

    const chatwootClient = container.resolve(CHATWOOT_CLIENT_TOKEN) as any;
    const messages = await chatwootClient.getMessages(
      conversationId,
      accountId,
      before ? Number(before) : undefined
    );

    return c.json({ success: true, data: messages });
  } catch (error) {
    console.error("[Messages] Error:", error);
    return c.json({ success: false, error: String(error) }, 500);
  }
});
