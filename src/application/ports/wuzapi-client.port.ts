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

export interface IWuzapiClient {
  sendText(payload: WuzapiSendTextPayload): Promise<WuzapiApiResponse<{ Id: string; Timestamp: string }>>;
  sendImage(payload: WuzapiSendImagePayload): Promise<WuzapiApiResponse<{ Id: string; Timestamp: string }>>;
  sendAudio(payload: WuzapiSendAudioPayload): Promise<WuzapiApiResponse<{ Id: string; Timestamp: string }>>;
  sendDocument(payload: WuzapiSendDocumentPayload): Promise<WuzapiApiResponse<{ Id: string; Timestamp: string }>>;
  sendVideo(payload: WuzapiSendVideoPayload): Promise<WuzapiApiResponse<{ Id: string; Timestamp: string }>>;
  sendSticker(payload: WuzapiSendStickerPayload): Promise<WuzapiApiResponse<{ Id: string; Timestamp: string }>>;
  sendLocation(payload: WuzapiSendLocationPayload): Promise<WuzapiApiResponse<{ Id: string; Timestamp: string }>>;
  downloadImage(payload: WuzapiDownloadMediaPayload): Promise<WuzapiApiResponse<{ base64: string; mimeType: string }>>;
  downloadVideo(payload: WuzapiDownloadMediaPayload): Promise<WuzapiApiResponse<{ base64: string; mimeType: string }>>;
  downloadAudio(payload: WuzapiDownloadMediaPayload): Promise<WuzapiApiResponse<{ base64: string; mimeType: string }>>;
  downloadDocument(payload: WuzapiDownloadMediaPayload): Promise<WuzapiApiResponse<{ base64: string; mimeType: string }>>;
  downloadSticker(payload: WuzapiDownloadMediaPayload): Promise<WuzapiApiResponse<{ base64: string; mimeType: string }>>;

  getSessionStatus(): Promise<WuzapiApiResponse<WuzapiSessionStatus>>;
  getWebhook(): Promise<WuzapiApiResponse<WuzapiWebhookConfig>>;
  setWebhook(url: string, events: string[]): Promise<WuzapiApiResponse<WuzapiWebhookConfig>>;

  getUserAvatar(phone: string): Promise<string | null>;
  getUserInfo(phone: string): Promise<Record<string, unknown> | null>;
}

export const WUZAPI_CLIENT_TOKEN = Symbol("IWuzapiClient");
