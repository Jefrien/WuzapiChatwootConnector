export interface EvolutionMessageKey {
  remoteJid: string;
  fromMe: boolean;
  id: string;
}

export interface EvolutionMessageData {
  key: EvolutionMessageKey;
  pushName?: string;
  message?: {
    conversation?: string;
    extendedTextMessage?: {
      text?: string;
      contextInfo?: {
        stanzaId?: string;
        participant?: string;
        quotedMessage?: { conversation?: string };
      };
    };
    imageMessage?: {
      caption?: string;
      url?: string;
      mimetype?: string;
      base64?: string;
    };
    videoMessage?: {
      caption?: string;
      url?: string;
      mimetype?: string;
      base64?: string;
    };
    audioMessage?: {
      url?: string;
      mimetype?: string;
      base64?: string;
      ptt?: boolean;
    };
    documentMessage?: {
      caption?: string;
      url?: string;
      mimetype?: string;
      base64?: string;
      fileName?: string;
    };
    stickerMessage?: {
      url?: string;
      mimetype?: string;
      base64?: string;
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
      key?: { id?: string };
      text?: string;
    };
    protocolMessage?: {
      type?: number;
      key?: { id?: string };
    };
    messageContextInfo?: unknown;
  };
  messageType?: string;
  messageTimestamp?: number;
  instanceId?: string;
  source?: string;
}

export interface EvolutionWebhookPayload {
  event: string;
  instance: string;
  data: EvolutionMessageData;
  destination?: string;
  date_time?: string;
  sender?: string;
  server_url?: string;
  apikey?: string;
}

export interface EvolutionSendTextPayload {
  number: string;
  text: string;
  options?: {
    delay?: number;
    presence?: "composing" | "recording" | "paused";
    linkPreview?: boolean;
  };
}

export interface EvolutionSendMediaPayload {
  number: string;
  mediatype: "image" | "video" | "audio" | "document";
  media: string;
  caption?: string;
  fileName?: string;
  options?: {
    delay?: number;
    presence?: "composing" | "recording" | "paused";
  };
}

export interface EvolutionApiResponse<T = unknown> {
  status: string;
  response?: T;
  error?: string;
}
