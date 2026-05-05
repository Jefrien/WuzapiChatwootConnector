import { injectable } from "tsyringe";
import { env } from "../../config";
import type { IWuzapiClient } from "../../application/ports/wuzapi-client.port";
import type {
  WuzapiSendTextPayload,
  WuzapiSendImagePayload,
  WuzapiSendAudioPayload,
  WuzapiSendDocumentPayload,
  WuzapiSendVideoPayload,
  WuzapiSendStickerPayload,
  WuzapiSendLocationPayload,
  WuzapiDownloadMediaPayload,
  WuzapiApiResponse,
  WuzapiSessionStatus,
  WuzapiWebhookConfig,
} from "../../domain/types/wuzapi";

@injectable()
export class WuzapiClient implements IWuzapiClient {
  private readonly baseUrl: string;
  private readonly token: string;

  constructor() {
    this.baseUrl = env.WUZAPI_BASE_URL;
    this.token = env.WUZAPI_TOKEN;
  }

  private async request<T>(
    path: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        token: this.token,
        ...options.headers,
      },
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Wuzapi API error ${response.status}: ${text}`);
    }

    return response.json() as Promise<T>;
  }

  async sendText(
    payload: WuzapiSendTextPayload
  ): Promise<WuzapiApiResponse<{ Id: string; Timestamp: string }>> {
    return this.request("/chat/send/text", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  async sendImage(
    payload: WuzapiSendImagePayload
  ): Promise<WuzapiApiResponse<{ Id: string; Timestamp: string }>> {
    return this.request("/chat/send/image", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  async sendAudio(
    payload: WuzapiSendAudioPayload
  ): Promise<WuzapiApiResponse<{ Id: string; Timestamp: string }>> {
    return this.request("/chat/send/audio", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  async sendDocument(
    payload: WuzapiSendDocumentPayload
  ): Promise<WuzapiApiResponse<{ Id: string; Timestamp: string }>> {
    return this.request("/chat/send/document", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  async sendVideo(
    payload: WuzapiSendVideoPayload
  ): Promise<WuzapiApiResponse<{ Id: string; Timestamp: string }>> {
    return this.request("/chat/send/video", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  async sendSticker(
    payload: WuzapiSendStickerPayload
  ): Promise<WuzapiApiResponse<{ Id: string; Timestamp: string }>> {
    return this.request("/chat/send/sticker", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  async sendLocation(
    payload: WuzapiSendLocationPayload
  ): Promise<WuzapiApiResponse<{ Id: string; Timestamp: string }>> {
    return this.request("/chat/send/location", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  async downloadMedia(
    payload: WuzapiDownloadMediaPayload
  ): Promise<WuzapiApiResponse<{ base64: string; mimeType: string }>> {
    return this.request("/chat/download", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  async getSessionStatus(): Promise<WuzapiApiResponse<WuzapiSessionStatus>> {
    return this.request("/session/status");
  }

  async getWebhook(): Promise<WuzapiApiResponse<WuzapiWebhookConfig>> {
    return this.request("/webhook");
  }

  async setWebhook(
    url: string,
    events: string[]
  ): Promise<WuzapiApiResponse<WuzapiWebhookConfig>> {
    return this.request("/webhook", {
      method: "POST",
      body: JSON.stringify({ webhook: url, events }),
    });
  }

  async getUserAvatar(phone: string): Promise<string | null> {
    try {
      const result = await this.request<
        WuzapiApiResponse<{ URL?: string; url?: string }>
      >("/user/avatar", {
        method: "POST",
        body: JSON.stringify({ Phone: phone, Preview: false }),
      });
      return result.data?.URL || result.data?.url || null;
    } catch {
      return null;
    }
  }

  async getUserInfo(phone: string): Promise<Record<string, unknown> | null> {
    try {
      const result = await this.request<
        WuzapiApiResponse<Record<string, unknown>>
      >("/user/info", {
        method: "POST",
        body: JSON.stringify({ Phone: phone }),
      });
      return result.data || null;
    } catch {
      return null;
    }
  }
}
