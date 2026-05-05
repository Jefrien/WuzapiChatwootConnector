export interface WuzapiWebhookPayload {
  type: string;
  event?: WuzapiMessageEvent;
  userID?: string;
  instanceName?: string;
  jsonData?: string;
}

export interface WuzapiMessageInfo {
  AddressingMode?: string;
  BroadcastListOwner?: string;
  BroadcastRecipients?: unknown;
  Category?: string;
  Chat: string; // JID del chat: "40888608784419@lid" o "120363...@g.us"
  DeviceSentMeta?: unknown;
  Edit?: string;
  ID: string; // ID del mensaje
  IsFromMe: boolean;
  IsGroup: boolean;
  MediaType?: string; // "ptt", "image", etc.
  MsgBotInfo?: unknown;
  MsgMetaInfo?: unknown;
  Multicast?: boolean;
  PushName: string; // Nombre del contacto
  RecipientAlt?: string;
  Sender: string; // JID del remitente
  SenderAlt?: string; // JID alternativo con número real: "50256207408@s.whatsapp.net"
  ServerID?: number;
  Timestamp: string; // ISO 8601
  Type?: string; // "media", "text", etc.
  VerifiedName?: unknown;
}

export interface WuzapiMediaMessage {
  URL?: string;
  directPath?: string;
  fileEncSHA256?: string;
  fileLength?: number;
  fileSHA256?: string;
  mediaKey?: string;
  mediaKeyTimestamp?: number;
  mimetype?: string;
  caption?: string;
  seconds?: number;
  PTT?: boolean;
  waveform?: string;
  fileName?: string;
  isAnimated?: boolean;
}

export interface WuzapiMessageEvent {
  Info: WuzapiMessageInfo;
  IsBotInvoke?: boolean;
  IsDocumentWithCaption?: boolean;
  IsEdit?: boolean;
  IsEphemeral?: boolean;
  IsLottieSticker?: boolean;
  IsViewOnce?: boolean;
  IsViewOnceV2?: boolean;
  IsViewOnceV2Extension?: boolean;
  Message: {
    conversation?: string;
    extendedTextMessage?: {
      text?: string;
      contextInfo?: {
        stanzaId?: string;
        participant?: string;
        quotedMessage?: { conversation?: string };
      };
    };
    imageMessage?: WuzapiMediaMessage;
    videoMessage?: WuzapiMediaMessage;
    audioMessage?: WuzapiMediaMessage;
    documentMessage?: WuzapiMediaMessage;
    stickerMessage?: WuzapiMediaMessage;
    contactMessage?: {
      displayName?: string;
      vcard?: string;
    };
    locationMessage?: {
      degreesLatitude?: number;
      degreesLongitude?: number;
      name?: string;
      address?: string;
    };
    reactionMessage?: {
      key?: { id?: string };
      text?: string;
    };
    protocolMessage?: {
      type?: number;
      key?: { id?: string };
    };
    messageContextInfo?: unknown;
  };
  RawMessage?: unknown;
  RetryCount?: number;
  SourceWebMsg?: unknown;
  UnavailableRequestID?: string;
  NewsletterMeta?: unknown;
}

export interface WuzapiSendTextPayload {
  Phone: string;
  Body: string;
  Id?: string;
  LinkPreview?: boolean;
  ContextInfo?: {
    StanzaId?: string;
    Participant?: string;
  };
}

export interface WuzapiSendMediaPayload {
  Phone: string;
  Id?: string;
  Caption?: string;
  ContextInfo?: {
    StanzaId?: string;
    Participant?: string;
  };
}

export interface WuzapiSendImagePayload extends WuzapiSendMediaPayload {
  Image: string;
}

export interface WuzapiSendAudioPayload extends WuzapiSendMediaPayload {
  Audio: string;
  PTT?: boolean;
}

export interface WuzapiSendDocumentPayload extends WuzapiSendMediaPayload {
  Document: string;
  FileName?: string;
}

export interface WuzapiSendVideoPayload extends WuzapiSendMediaPayload {
  Video: string;
}

export interface WuzapiSendStickerPayload extends WuzapiSendMediaPayload {
  Sticker: string;
}

export interface WuzapiSendLocationPayload {
  Phone: string;
  Latitude: number;
  Longitude: number;
  Name?: string;
  Address?: string;
}

export interface WuzapiDownloadMediaPayload {
  Url?: string;
  DirectPath?: string;
  MediaKey?: string;
  Mimetype?: string;
  FileEncSHA256?: string;
  FileSHA256?: string;
  FileLength?: number;
}

export interface WuzapiDownloadMediaResponse {
  Data: string;
  Mimetype: string;
}

export interface WuzapiListRow {
  RowId: string;
  Title: string;
  Description: string;
}

export interface WuzapiListSection {
  Title: string;
  Rows: WuzapiListRow[];
}

export interface WuzapiSendListPayload {
  Phone: string;
  Title: string;
  Description: string;
  ButtonText: string;
  Sections: WuzapiListSection[];
}

export interface WuzapiButton {
  type: string;
  title: string;
  id: string;
  url?: string;
  phone_number?: string;
  copy_code?: string;
}

export interface WuzapiSendButtonsPayload {
  Phone: string;
  Body?: string;
  Title?: string;
  Footer?: string;
  Image?: string;
  Id?: string;
  Buttons: WuzapiButton[];
  ContextInfo?: {
    StanzaId?: string;
    Participant?: string;
  };
}

export interface WuzapiApiResponse<T = unknown> {
  code: number;
  data: T;
  success: boolean;
  error?: string;
}

export interface WuzapiSessionStatus {
  Connected: boolean;
  LoggedIn: boolean;
}

export interface WuzapiWebhookConfig {
  webhook: string;
  events: string[];
}
