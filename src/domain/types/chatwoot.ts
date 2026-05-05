export enum ChatwootEventType {
  MESSAGE_CREATED = "message_created",
  MESSAGE_UPDATED = "message_updated",
  MESSAGE_DELETED = "message_deleted",
  CONVERSATION_CREATED = "conversation_created",
  CONVERSATION_STATUS_CHANGED = "conversation_status_changed",
  CONTACT_CREATED = "contact_created",
  CONTACT_UPDATED = "contact_updated",
}

export enum ChatwootMessageType {
  INCOMING = "incoming",
  OUTGOING = "outgoing",
  ACTIVITY = "activity",
}

export enum ChatwootMessageContentType {
  TEXT = "text",
  INPUT_CSAT = "input_csat",
}

export interface ChatwootAttachment {
  id: number;
  account_id: number;
  message_id: number;
  file_type: "image" | "video" | "audio" | string;
  file_size: number;
  data_url?: string;
  thumb_url?: string;
  extension?: string;
  width?: number;
  height?: number;
}

export interface ChatwootConversation {
  id: number;
  account_id: number;
  inbox_id: number;
  status: "open" | "pending" | "resolved" | "snoozed";
  contact_inbox?: {
    source_id: string;
  };
}

export interface ChatwootContact {
  id: number;
  name: string;
  phone_number?: string;
  email?: string;
  thumbnail?: string;
  custom_attributes?: Record<string, string>;
  contact_inboxes?: Array<{
    source_id: string;
    inbox: { id: number };
  }>;
}

export interface ChatwootSender {
  id: number;
  name: string;
  email?: string;
  phone_number?: string;
  thumbnail?: string;
}

export interface ChatwootMessagePayload {
  event: ChatwootEventType;
  message_type: ChatwootMessageType;
  id: number;
  content: string;
  content_type: ChatwootMessageContentType;
  content_attributes?: {
    deleted?: boolean;
    in_reply_to?: number;
    external_error?: string | null;
  };
  private: boolean;
  created_at: string;
  conversation: ChatwootConversation;
  sender: ChatwootSender;
  attachments?: ChatwootAttachment[];
}

export interface ChatwootWebhookBody {
  event: string;
  message_type?: string;
  id?: number;
  content?: string;
  content_type?: string;
  private?: boolean;
  conversation?: ChatwootConversation;
  sender?: ChatwootSender;
  attachments?: ChatwootAttachment[];
  content_attributes?: Record<string, unknown>;
}

export interface ChatwootCreateContactPayload {
  inbox_id: number;
  name: string;
  phone_number?: string;
  email?: string;
  avatar_url?: string;
  custom_attributes?: Record<string, string>;
  identifier?: string;
}

export interface ChatwootCreateMessagePayload {
  content: string;
  message_type?: "incoming" | "outgoing";
  private?: boolean;
  attachments?: Array<{
    content: string;
    filename: string;
    encoding: "base64";
  }>;
}
