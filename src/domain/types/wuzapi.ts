export interface WuzapiWebhookPayload {
  type: string;
  event?: unknown;
  userID?: string;
  instanceName?: string;
}

export interface WuzapiMessageEvent {
  Info: {
    ID: string;
    PushName: string;
    Timestamp: string;
    SourceString: string;
    IsFromMe: boolean;
    IsGroup: boolean;
    Sender: {
      User: string;
      Server: string;
      RawAgent?: string;
      Device?: number;
    };
    Chat: {
      User: string;
      Server: string;
    };
    Type?: string;
    Category?: string;
  };
  Message: {
    conversation?: string;
    extendedTextMessage?: {
      text: string;
      contextInfo?: {
        stanzaId?: string;
        participant?: string;
        quotedMessage?: {
          conversation?: string;
        };
      };
    };
    imageMessage?: {
      caption?: string;
      mimetype?: string;
    };
    videoMessage?: {
      caption?: string;
      mimetype?: string;
    };
    audioMessage?: {
      mimetype?: string;
      ptt?: boolean;
      seconds?: number;
    };
    documentMessage?: {
      caption?: string;
      mimetype?: string;
      fileName?: string;
    };
    stickerMessage?: {
      mimetype?: string;
      isAnimated?: boolean;
    };
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
      key?: {
        id?: string;
      };
      text?: string;
    };
    protocolMessage?: {
      type?: number;
      key?: {
        id?: string;
      };
    };
  };
  IsViewOnce?: boolean;
  IsEphemeral?: boolean;
}

export interface WuzapiMessageWebhook extends WuzapiWebhookPayload {
  type: "Message";
  event: WuzapiMessageEvent;
  base64?: string;
  mimeType?: string;
  fileName?: string;
  s3?: {
    url: string;
    bucket?: string;
    key?: string;
  };
}

export interface WuzapiReadReceiptEvent {
  MessageIDs: string[];
  SourceString: string;
  Timestamp: string;
  Type?: string;
}

export interface WuzapiReadReceiptWebhook extends WuzapiWebhookPayload {
  type: "ReadReceipt";
  event: WuzapiReadReceiptEvent;
  state: "Read" | "ReadSelf" | "Delivered";
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
