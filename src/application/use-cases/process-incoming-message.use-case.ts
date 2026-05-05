import { inject, injectable } from "tsyringe";
import type { WuzapiMessageEvent, WuzapiMediaMessage } from "../../domain/types/wuzapi";
import type { ChatwootCreateContactPayload, ChatwootCreateMessagePayload } from "../../domain/types/chatwoot";
import { CHATWOOT_CLIENT_TOKEN, type IChatwootClient } from "../ports/chatwoot-client.port";
import { WUZAPI_CLIENT_TOKEN, type IWuzapiClient } from "../ports/wuzapi-client.port";
import { MESSAGE_MAPPING_REPOSITORY_TOKEN, type IMessageMappingRepository } from "../ports/message-mapping.repository.port";

@injectable()
export class ProcessIncomingMessageUseCase {
  constructor(
    @inject(CHATWOOT_CLIENT_TOKEN)
    private readonly chatwootClient: IChatwootClient,
    @inject(WUZAPI_CLIENT_TOKEN)
    private readonly wuzapiClient: IWuzapiClient,
    @inject(MESSAGE_MAPPING_REPOSITORY_TOKEN)
    private readonly mappingRepo: IMessageMappingRepository
  ) {}

  async execute(payload: { event?: WuzapiMessageEvent; type?: string }): Promise<void> {
    const event = payload.event;
    if (!event) {
      console.log("[Incoming] No event in payload");
      return;
    }

    const info = event.Info;
    const chatId = info.Chat;
    const phone = this.extractPhone(info);
    const isFromMe = info.IsFromMe;

    // Skip outgoing messages from WhatsApp
    if (isFromMe) {
      console.log("[Incoming] Skipping outgoing message from WhatsApp");
      return;
    }

    // 1. Find or create contact
    let contact = await this.chatwootClient.findContactByIdentifier(chatId);
    if (!contact) {
      contact = await this.chatwootClient.findContactByPhone(phone);
    }

    let contactSourceId: string;

    if (!contact) {
      const contactPayload: ChatwootCreateContactPayload = {
        inbox_id: 0,
        name: info.PushName || phone,
        phone_number: phone,
        identifier: chatId,
        custom_attributes: {
          whatsapp_chat_id: chatId,
          whatsapp_jid: info.Sender,
        },
      };
      const createResult = await this.chatwootClient.createContact(contactPayload);
      contact = createResult.contact;
      contactSourceId = createResult.sourceId;

      // Try to update avatar on first contact
      try {
        const avatarUrl = await this.wuzapiClient.getUserAvatar(phone);
        if (avatarUrl) {
          await this.chatwootClient.updateContactAvatar(contact.id, avatarUrl);
        }
      } catch {
        // Ignore avatar errors
      }
    } else {
      contactSourceId = contact.contact_inboxes?.find(
        (ci) => ci.inbox?.id
      )?.source_id || "";

      await this.chatwootClient.updateContactAttributes(contact.id, {
        whatsapp_chat_id: chatId,
        whatsapp_jid: info.Sender,
      });
    }

    // 2. Find or create conversation
    let conversation = await this.chatwootClient.findConversationByContactId(contact.id);
    if (!conversation) {
      if (!contactSourceId) {
        throw new Error(`No source_id found for contact ${contact.id}`);
      }
      conversation = await this.chatwootClient.createConversation(contactSourceId);
    }

    // 3. Build message content
    const messageContent = this.buildMessageContent(event);

    // 4. Handle media if present
    const chatwootPayload: ChatwootCreateMessagePayload = {
      content: messageContent.text,
      message_type: "incoming",
      private: false,
    };

    const media = messageContent.media;
    if (media) {
      try {
        const downloaded = await this.wuzapiClient.downloadMedia({
          Url: media.URL,
          DirectPath: media.directPath,
          MediaKey: media.mediaKey,
          Mimetype: media.mimetype,
          FileEncSHA256: media.fileEncSHA256,
          FileSHA256: media.fileSHA256,
          FileLength: media.fileLength,
        });

        if (downloaded.success && downloaded.data?.base64) {
          const ext = this.getExtensionFromMime(media.mimetype || "");
          const filename = `media_${Date.now()}${ext}`;
          chatwootPayload.attachments = [
            {
              content: downloaded.data.base64,
              filename,
              encoding: "base64",
            },
          ];
        }
      } catch (err) {
        console.error("[Incoming] Failed to download media:", err);
        // Include the URL in the text as fallback
        if (media.URL) {
          chatwootPayload.content = `${messageContent.text}\n${media.URL}`.trim();
        }
      }
    }

    // 5. Send message to Chatwoot
    const chatwootMessage = await this.chatwootClient.createMessage(
      conversation.id,
      chatwootPayload
    );

    // 6. Save mapping
    await this.mappingRepo.save({
      wuzapiMessageId: info.ID,
      chatwootMessageId: chatwootMessage.id,
      chatwootConversationId: conversation.id,
      wuzapiPhone: phone,
      chatwootContactId: contact.id,
      direction: "inbound",
    });

    console.log(
      `[Incoming] Synced WA message ${info.ID} (${phone}) -> Chatwoot message ${chatwootMessage.id}`
    );
  }

  private extractPhone(info: WuzapiMessageEvent["Info"]): string {
    // Prefer SenderAlt which has the real phone number
    if (info.SenderAlt) {
      return info.SenderAlt.replace(/@s\.whatsapp\.net|@lid|@g\.us/g, "");
    }
    // Fallback to Sender
    return info.Sender.replace(/@s\.whatsapp\.net|@lid|@g\.us/g, "");
  }

  private buildMessageContent(event: WuzapiMessageEvent): { text: string; media?: WuzapiMediaMessage } {
    const msg = event.Message;
    let text = "";
    let media: WuzapiMediaMessage | undefined;

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

    // Media detection
    if (msg.imageMessage) {
      media = msg.imageMessage;
      text = msg.imageMessage.caption || ":image:";
    } else if (msg.videoMessage) {
      media = msg.videoMessage;
      text = msg.videoMessage.caption || ":video:";
    } else if (msg.audioMessage) {
      media = msg.audioMessage;
      text = msg.audioMessage.PTT ? ":voice:" : ":audio:";
    } else if (msg.documentMessage) {
      media = msg.documentMessage;
      text = msg.documentMessage.caption || ":document:";
    } else if (msg.stickerMessage) {
      media = msg.stickerMessage;
      text = ":sticker:";
    } else if (msg.contactMessage) {
      text = `Contact: ${msg.contactMessage.displayName || ""}`;
    } else if (msg.locationMessage) {
      const loc = msg.locationMessage;
      text = `📍 Location: ${loc.name || ""} ${loc.address || ""} (${loc.degreesLatitude}, ${loc.degreesLongitude})`;
    }

    return { text, media };
  }

  private getExtensionFromMime(mime: string): string {
    if (mime.includes("image")) return ".jpg";
    if (mime.includes("video")) return ".mp4";
    if (mime.includes("audio")) return ".ogg";
    if (mime.includes("webp")) return ".webp";
    return ".bin";
  }
}
