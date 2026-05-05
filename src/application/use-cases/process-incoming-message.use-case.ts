import { inject, injectable } from "tsyringe";
import type {
  WuzapiMessageWebhook,
  WuzapiMessageEvent,
} from "../../domain/types/wuzapi";
import type {
  ChatwootCreateContactPayload,
  ChatwootCreateMessagePayload,
} from "../../domain/types/chatwoot";
import { CHATWOOT_CLIENT_TOKEN, type IChatwootClient } from "../ports/chatwoot-client.port";
import {
  MESSAGE_MAPPING_REPOSITORY_TOKEN,
  type IMessageMappingRepository,
} from "../ports/message-mapping.repository.port";

@injectable()
export class ProcessIncomingMessageUseCase {
  constructor(
    @inject(CHATWOOT_CLIENT_TOKEN)
    private readonly chatwootClient: IChatwootClient,
    @inject(MESSAGE_MAPPING_REPOSITORY_TOKEN)
    private readonly mappingRepo: IMessageMappingRepository
  ) {}

  async execute(payload: WuzapiMessageWebhook): Promise<void> {
    const event = payload.event;
    const chatId = this.extractChatId(event);
    const phone = this.extractPhone(event);
    const isFromMe = event.Info.IsFromMe;

    // Skip outgoing messages from WhatsApp (we handle those via Chatwoot webhook)
    if (isFromMe) {
      console.log("[Incoming] Skipping outgoing message from WhatsApp");
      return;
    }

    // 1. Find or create contact
    let contact = await this.chatwootClient.findContactByIdentifier(chatId);
    if (!contact) {
      contact = await this.chatwootClient.findContactByPhone(phone);
    }

    if (!contact) {
      const contactPayload: ChatwootCreateContactPayload = {
        inbox_id: 0, // Will be set by client implementation
        name: event.Info.PushName || phone,
        phone_number: phone,
        identifier: chatId,
        custom_attributes: {
          whatsapp_chat_id: chatId,
        },
      };
      contact = await this.chatwootClient.createContact(contactPayload);
    } else {
      // Ensure custom attributes are up to date
      await this.chatwootClient.updateContactAttributes(contact.id, {
        whatsapp_chat_id: chatId,
      });
    }

    // 2. Find or create conversation
    let conversation = await this.chatwootClient.findConversationByContactId(contact.id);
    if (!conversation) {
      const sourceId = contact.contact_inboxes?.find(
        (ci) => ci.inbox?.id
      )?.source_id;
      if (!sourceId) {
        throw new Error(`No source_id found for contact ${contact.id}`);
      }
      conversation = await this.chatwootClient.createConversation(sourceId);
    }

    // 3. Build message content
    const messageContent = this.buildMessageContent(event);

    // 4. Handle media if present
    const chatwootPayload: ChatwootCreateMessagePayload = {
      content: messageContent.text,
      message_type: "incoming",
      private: false,
    };

    if (payload.base64 && payload.mimeType) {
      const filename = payload.fileName || `file_${Date.now()}`;
      chatwootPayload.attachments = [
        {
          content: payload.base64,
          filename,
          encoding: "base64",
        },
      ];
    } else if (messageContent.mediaUrl) {
      // If we have an S3 URL, include it in the text
      chatwootPayload.content = `${messageContent.text}\n${messageContent.mediaUrl}`.trim();
    }

    // 5. Send message to Chatwoot
    const chatwootMessage = await this.chatwootClient.createMessage(
      conversation.id,
      chatwootPayload
    );

    // 6. Save mapping
    await this.mappingRepo.save({
      wuzapiMessageId: event.Info.ID,
      chatwootMessageId: chatwootMessage.id,
      chatwootConversationId: conversation.id,
      wuzapiPhone: phone,
      chatwootContactId: contact.id,
      direction: "inbound",
    });

    console.log(
      `[Incoming] Synced WA message ${event.Info.ID} -> Chatwoot message ${chatwootMessage.id}`
    );
  }

  private extractChatId(event: WuzapiMessageEvent): string {
    if (event.Info.IsGroup) {
      return `${event.Info.Chat.User}@${event.Info.Chat.Server}`;
    }
    return `${event.Info.Sender.User}@${event.Info.Sender.Server}`;
  }

  private extractPhone(event: WuzapiMessageEvent): string {
    return event.Info.Sender.User;
  }

  private buildMessageContent(event: WuzapiMessageEvent): { text: string; mediaUrl?: string } {
    const msg = event.Message;
    let text = "";

    // Protocol message (delete)
    if (msg.protocolMessage?.type === 0) {
      return { text: "🗑️ Message deleted" };
    }

    // Reaction
    if (msg.reactionMessage?.text) {
      return { text: `👍 Reaction: ${msg.reactionMessage.text}` };
    }

    // Text
    if (msg.conversation) {
      text = msg.conversation;
    } else if (msg.extendedTextMessage?.text) {
      text = msg.extendedTextMessage.text;
    }

    // Media with captions
    if (msg.imageMessage?.caption) {
      text = msg.imageMessage.caption;
    } else if (msg.videoMessage?.caption) {
      text = msg.videoMessage.caption;
    } else if (msg.documentMessage?.caption) {
      text = msg.documentMessage.caption;
    }

    // Media placeholders if no caption
    if (!text) {
      if (msg.imageMessage) text = ":image:";
      else if (msg.videoMessage) text = ":video:";
      else if (msg.audioMessage) text = ":audio:";
      else if (msg.documentMessage) text = ":document:";
      else if (msg.stickerMessage) text = ":sticker:";
      else if (msg.contactMessage) text = `Contact: ${msg.contactMessage.displayName || ""}`;
      else if (msg.locationMessage) {
        const loc = msg.locationMessage;
        text = `📍 Location: ${loc.name || ""} ${loc.address || ""} (${loc.degreesLatitude}, ${loc.degreesLongitude})`;
      }
    }

    return { text };
  }
}
