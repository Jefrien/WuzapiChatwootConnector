import { inject, injectable } from "tsyringe";
import type { ChatwootMessagePayload, ChatwootAttachment } from "../../domain/types/chatwoot";
import {
  WUZAPI_CLIENT_TOKEN,
  type IWuzapiClient,
} from "../ports/wuzapi-client.port";
import {
  MESSAGE_MAPPING_REPOSITORY_TOKEN,
  type IMessageMappingRepository,
} from "../ports/message-mapping.repository.port";

@injectable()
export class ProcessOutgoingMessageUseCase {
  constructor(
    @inject(WUZAPI_CLIENT_TOKEN)
    private readonly wuzapiClient: IWuzapiClient,
    @inject(MESSAGE_MAPPING_REPOSITORY_TOKEN)
    private readonly mappingRepo: IMessageMappingRepository
  ) {}

  async execute(payload: ChatwootMessagePayload): Promise<void> {
    // Skip incoming messages (we handle those via Wuzapi webhook)
    if (payload.message_type === "incoming") {
      console.log("[Outgoing] Skipping incoming message from Chatwoot");
      return;
    }

    // Skip private notes (unless deleted)
    if (payload.private && !payload.content_attributes?.deleted) {
      console.log("[Outgoing] Skipping private note");
      return;
    }

    // Extract phone from conversation or sender
    const phone = await this.extractPhone(payload);
    if (!phone) {
      throw new Error("Could not extract phone number from Chatwoot payload");
    }

    // Handle deleted messages
    if (payload.content_attributes?.deleted) {
      console.log("[Outgoing] Message deleted event, not supported for Wuzapi");
      return;
    }

    // Get reply-to if applicable
    const replyTo = await this.resolveReplyTo(payload);

    // Handle attachments
    const attachments = payload.attachments || [];
    const results: Array<{ Id: string }> = [];

    // If there's text and no single attachment (text is the caption), send text first
    const hasSingleAttachment = attachments.length === 1;
    const sendText = payload.content && (!hasSingleAttachment || payload.content !== attachments[0].data_url);

    if (sendText) {
      const textResult = await this.wuzapiClient.sendText({
        Phone: phone,
        Body: payload.content,
        ContextInfo: replyTo
          ? { StanzaId: replyTo, Participant: `${phone}@s.whatsapp.net` }
          : undefined,
      });
      if (textResult.success && textResult.data?.Id) {
        results.push({ Id: textResult.data.Id });
      }
    }

    // Send attachments
    for (const attachment of attachments) {
      if (!attachment.data_url) continue;
      const result = await this.sendAttachment(phone, attachment, payload.content, replyTo);
      if (result) {
        results.push(result);
      }
    }

    // Save mappings
    for (let i = 0; i < results.length; i++) {
      await this.mappingRepo.save({
        wuzapiMessageId: results[i].Id,
        chatwootMessageId: payload.id,
        chatwootConversationId: payload.conversation.id,
        wuzapiPhone: phone,
        chatwootContactId: payload.sender.id,
        direction: "outbound",
        part: i + 1,
      });
    }

    console.log(
      `[Outgoing] Synced Chatwoot message ${payload.id} -> WA (${results.length} parts)`
    );
  }

  private async sendAttachment(
    phone: string,
    attachment: ChatwootAttachment,
    caption: string,
    replyTo?: string
  ): Promise<{ Id: string } | null> {
    // Fetch the file from data_url
    if (!attachment.data_url) return null;
    const response = await fetch(attachment.data_url);
    if (!response.ok) {
      console.error(`Failed to fetch attachment: ${attachment.data_url}`);
      return null;
    }
    const buffer = Buffer.from(await response.arrayBuffer());
    const base64 = `data:${this.getMimeType(attachment.file_type)};base64,${buffer.toString("base64")}`;

    const context = replyTo
      ? { StanzaId: replyTo, Participant: `${phone}@s.whatsapp.net` }
      : undefined;

    switch (attachment.file_type) {
      case "image": {
        const result = await this.wuzapiClient.sendImage({
          Phone: phone,
          Image: base64,
          Caption: caption,
          ContextInfo: context,
        });
        return result.success ? (result.data as { Id: string }) : null;
      }
      case "video": {
        const result = await this.wuzapiClient.sendVideo({
          Phone: phone,
          Video: base64,
          Caption: caption,
          ContextInfo: context,
        });
        return result.success ? (result.data as { Id: string }) : null;
      }
      case "audio": {
        const result = await this.wuzapiClient.sendAudio({
          Phone: phone,
          Audio: base64,
          PTT: true,
          ContextInfo: context,
        });
        return result.success ? (result.data as { Id: string }) : null;
      }
      default: {
        // Send as document
        const result = await this.wuzapiClient.sendDocument({
          Phone: phone,
          Document: base64,
          FileName: `file_${Date.now()}`,
          Caption: caption,
          ContextInfo: context,
        });
        return result.success ? (result.data as { Id: string }) : null;
      }
    }
  }

  private getMimeType(fileType: string): string {
    switch (fileType) {
      case "image":
        return "image/jpeg";
      case "video":
        return "video/mp4";
      case "audio":
        return "audio/ogg";
      default:
        return "application/octet-stream";
    }
  }

  private async extractPhone(payload: ChatwootMessagePayload): Promise<string | null> {
    // Try sender phone
    if (payload.sender?.phone_number) {
      return payload.sender.phone_number.replace(/\+/g, "");
    }

    // Try conversation source_id (usually phone number)
    if (payload.conversation?.contact_inbox?.source_id) {
      return payload.conversation.contact_inbox.source_id.replace(/\+/g, "");
    }

    // Try to find mapping by conversation (most reliable fallback)
    if (payload.conversation?.id) {
      const latestMapping = await this.mappingRepo.findLatestByConversation(
        payload.conversation.id
      );
      if (latestMapping) {
        return latestMapping.wuzapiPhone;
      }
    }

    // Try to find mapping by message id
    const mapping = await this.mappingRepo.findByChatwootId(payload.id);
    if (mapping) {
      return mapping.wuzapiPhone;
    }

    return null;
  }

  private async resolveReplyTo(payload: ChatwootMessagePayload): Promise<string | undefined> {
    const replyToId = payload.content_attributes?.in_reply_to;
    if (!replyToId) return undefined;

    const mapping = await this.mappingRepo.findByChatwootId(replyToId);
    if (mapping) {
      return mapping.wuzapiMessageId;
    }

    return undefined;
  }
}
