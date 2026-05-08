import { Hono } from "hono";
import { container } from "tsyringe";
import { UpdateConversationCustomAttributesUseCase } from "../../application/use-cases/update-conversation-custom-attributes.use-case";

export const conversationsController = new Hono();

conversationsController.post(
  "/conversations/:accountId/:conversationId/custom-attributes",
  async (c) => {
    try {
      const accountId = Number(c.req.param("accountId"));
      const conversationId = Number(c.req.param("conversationId"));

      if (isNaN(accountId) || isNaN(conversationId)) {
        return c.json(
          { success: false, error: "Invalid accountId or conversationId" },
          400,
        );
      }

      const body = await c.req.json();

      if (!body.custom_attributes || typeof body.custom_attributes !== "object") {
        return c.json(
          { success: false, error: "Missing required field: custom_attributes" },
          400,
        );
      }

      const useCase = container.resolve(UpdateConversationCustomAttributesUseCase);
      await useCase.execute({
        conversationId,
        accountId,
        customAttributes: body.custom_attributes,
      });

      return c.json({ success: true });
    } catch (error) {
      console.error("[Conversations] Error updating custom attributes:", error);
      return c.json({ success: false, error: String(error) }, 500);
    }
  },
);
