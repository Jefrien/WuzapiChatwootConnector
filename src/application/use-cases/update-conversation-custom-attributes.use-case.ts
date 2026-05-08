import { inject, injectable } from "tsyringe";
import {
  CHATWOOT_CLIENT_TOKEN,
  type IChatwootClient,
} from "../ports/chatwoot-client.port";

export interface UpdateConversationCustomAttributesPayload {
  conversationId: number;
  accountId?: number;
  customAttributes: Record<string, string | number | boolean | null>;
}

@injectable()
export class UpdateConversationCustomAttributesUseCase {
  constructor(
    @inject(CHATWOOT_CLIENT_TOKEN)
    private readonly chatwootClient: IChatwootClient,
  ) {}

  async execute(
    payload: UpdateConversationCustomAttributesPayload,
  ): Promise<void> {
    const { conversationId, customAttributes } = payload;

    await this.chatwootClient.updateConversationCustomAttributes(
      conversationId,
      customAttributes,
    );

    console.log(
      `[UpdateConversationCustomAttributes] Updated conversation ${conversationId}`,
    );
  }
}
