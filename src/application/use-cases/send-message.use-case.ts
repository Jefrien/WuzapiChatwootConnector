import { inject, injectable } from "tsyringe";
import {
  CHATWOOT_CLIENT_TOKEN,
  type IChatwootClient,
} from "../ports/chatwoot-client.port";
import {
  WUZAPI_CLIENT_TOKEN,
  type IWuzapiClient,
} from "../ports/wuzapi-client.port";
import {
  MESSAGE_MAPPING_REPOSITORY_TOKEN,
  type IMessageMappingRepository,
} from "../ports/message-mapping.repository.port";

export interface SendMessagePayload {
  phone: string;
  conversationId: number;
  accountId?: number;
  type:
    | "text"
    | "image"
    | "video"
    | "audio"
    | "document"
    | "sticker"
    | "location"
    | "list"
    | "buttons";
  content: string;
  mediaBase64?: string;
  fileName?: string;
  latitude?: number;
  longitude?: number;
  locationName?: string;
  locationAddress?: string;
  listPayload?: {
    title: string;
    description: string;
    buttonText: string;
    sections: Array<{
      title: string;
      rows: Array<{ rowId: string; title: string; description: string }>;
    }>;
  };
  buttonsPayload?: {
    footer?: string;
    image?: string;
    id?: string;
    buttons: Array<{
      buttonId: string;
      buttonText: string;
      type?: string;
      url?: string;
      phoneNumber?: string;
      copyCode?: string;
    }>;
  };
}

@injectable()
export class SendMessageUseCase {
  constructor(
    @inject(CHATWOOT_CLIENT_TOKEN)
    private readonly chatwootClient: IChatwootClient,
    @inject(WUZAPI_CLIENT_TOKEN)
    private readonly wuzapiClient: IWuzapiClient,
    @inject(MESSAGE_MAPPING_REPOSITORY_TOKEN)
    private readonly mappingRepo: IMessageMappingRepository,
  ) {}

  async execute(
    payload: SendMessagePayload,
  ): Promise<{ chatwootMessageId: number; wuzapiMessageId?: string }> {
    const { phone, conversationId, type, content } = payload;

    // 1. Send to Chatwoot first (as outgoing text for agent visibility)
    const chatwootPayload: {
      content: string;
      message_type: "outgoing";
      private: boolean;
      attachments?: any[];
    } = {
      content: content,
      message_type: "outgoing",
      private: false,
    };

    // If there's media, attach it to Chatwoot too
    if (payload.mediaBase64) {
      let base64 = payload.mediaBase64;
      if (base64.includes("base64,")) {
        base64 = base64.split("base64,")[1];
      }
      const ext = this.getExtensionFromType(type);
      chatwootPayload.attachments = [
        {
          content: base64,
          filename: payload.fileName || `media_${Date.now()}${ext}`,
          encoding: "base64" as const,
        },
      ];
    }

    const chatwootMessage = await this.chatwootClient.createMessage(
      conversationId,
      chatwootPayload,
      payload.accountId,
    );
    console.log(
      `[SendMessage] Chatwoot message created: ${chatwootMessage.id}`,
    );

    // Save PENDING mapping immediately to prevent webhook from re-sending
    await this.mappingRepo.save({
      wuzapiMessageId: "PENDING",
      chatwootMessageId: chatwootMessage.id,
      chatwootConversationId: conversationId,
      wuzapiPhone: phone,
      direction: "outbound",
    });

    // 2. Send to Wuzapi based on type
    let wuzapiResult: { data?: { Id: string } } | undefined;

    switch (type) {
      case "text": {
        wuzapiResult = await this.wuzapiClient.sendText({
          Phone: phone,
          Body: content,
        });
        break;
      }
      case "image": {
        if (!payload.mediaBase64)
          throw new Error("mediaBase64 is required for image messages");
        wuzapiResult = await this.wuzapiClient.sendImage({
          Phone: phone,
          Image: payload.mediaBase64,
          Caption: content,
        });
        break;
      }
      case "video": {
        if (!payload.mediaBase64)
          throw new Error("mediaBase64 is required for video messages");
        wuzapiResult = await this.wuzapiClient.sendVideo({
          Phone: phone,
          Video: payload.mediaBase64,
          Caption: content,
        });
        break;
      }
      case "audio": {
        if (!payload.mediaBase64)
          throw new Error("mediaBase64 is required for audio messages");
        wuzapiResult = await this.wuzapiClient.sendAudio({
          Phone: phone,
          Audio: payload.mediaBase64,
          PTT: false,
        });
        break;
      }
      case "document": {
        if (!payload.mediaBase64)
          throw new Error("mediaBase64 is required for document messages");
        wuzapiResult = await this.wuzapiClient.sendDocument({
          Phone: phone,
          Document: payload.mediaBase64,
          FileName: payload.fileName || `document_${Date.now()}.pdf`,
          Caption: content,
        });
        break;
      }
      case "sticker": {
        if (!payload.mediaBase64)
          throw new Error("mediaBase64 is required for sticker messages");
        wuzapiResult = await this.wuzapiClient.sendSticker({
          Phone: phone,
          Sticker: payload.mediaBase64,
        });
        break;
      }
      case "location": {
        if (payload.latitude === undefined || payload.longitude === undefined) {
          throw new Error(
            "latitude and longitude are required for location messages",
          );
        }
        wuzapiResult = await this.wuzapiClient.sendLocation({
          Phone: phone,
          Latitude: payload.latitude,
          Longitude: payload.longitude,
          Name: payload.locationName,
          Address: payload.locationAddress,
        });
        break;
      }
      case "list": {
        if (!payload.listPayload)
          throw new Error("listPayload is required for list messages");
        wuzapiResult = await this.wuzapiClient.sendList({
          Phone: phone,
          Title: payload.listPayload.title,
          Description: payload.listPayload.description,
          ButtonText: payload.listPayload.buttonText,
          Sections: payload.listPayload.sections.map((s) => ({
            Title: s.title,
            Rows: s.rows.map((r) => ({
              RowId: r.rowId,
              Title: r.title,
              Description: r.description,
            })),
          })),
        });
        break;
      }
      case "buttons": {
        if (!payload.buttonsPayload)
          throw new Error("buttonsPayload is required for button messages");
        wuzapiResult = await this.wuzapiClient.sendButtons({
          Phone: phone,
          Body: content,
          Title: " ",
          Footer: payload.buttonsPayload.footer,
          Image: payload.buttonsPayload.image,
          Id: payload.buttonsPayload.id,
          Buttons: payload.buttonsPayload.buttons.map((b) => ({
            type: b.type || "reply",
            title: b.buttonText,
            id: b.buttonId,
            url: b.url,
            phone_number: b.phoneNumber,
            copy_code: b.copyCode,
          })),
        });
        break;
      }
      default:
        throw new Error(`Unsupported message type: ${type}`);
    }

    const wuzapiMessageId = (wuzapiResult as any)?.data?.Id;
    console.log(
      `[SendMessage] Wuzapi message sent: ${wuzapiMessageId || "unknown"}`,
    );

    // 3. Update mapping with real wuzapiMessageId
    if (wuzapiMessageId) {
      await this.mappingRepo.updateWuzapiMessageId(
        chatwootMessage.id,
        wuzapiMessageId,
      );
    }

    return {
      chatwootMessageId: chatwootMessage.id,
      wuzapiMessageId,
    };
  }

  private getExtensionFromType(type: string): string {
    switch (type) {
      case "image":
        return ".jpg";
      case "video":
        return ".mp4";
      case "audio":
        return ".ogg";
      case "document":
        return ".pdf";
      case "sticker":
        return ".webp";
      default:
        return ".bin";
    }
  }
}
