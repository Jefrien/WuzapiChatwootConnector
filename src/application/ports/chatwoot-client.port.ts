import type {
  ChatwootContact,
  ChatwootConversation,
  ChatwootCreateContactPayload,
  ChatwootCreateMessagePayload,
} from "../../domain/types/chatwoot";

export interface CreateContactResult {
  contact: ChatwootContact;
  sourceId: string;
}

export interface IChatwootClient {
  findContactByPhone(phone: string): Promise<ChatwootContact | null>;
  findContactByIdentifier(identifier: string): Promise<ChatwootContact | null>;
  createContact(payload: ChatwootCreateContactPayload): Promise<CreateContactResult>;
  updateContactAttributes(
    contactId: number,
    attributes: Record<string, string>
  ): Promise<void>;
  updateContactAvatar(contactId: number, avatarUrl: string): Promise<void>;

  findConversationByContactId(contactId: number): Promise<ChatwootConversation | null>;
  createConversation(contactSourceId: string): Promise<ChatwootConversation>;

  createMessage(
    conversationId: number,
    payload: ChatwootCreateMessagePayload
  ): Promise<{ id: number; content: string }>;

  markConversationAsRead(conversationId: number, sourceId: string): Promise<void>;
}

export const CHATWOOT_CLIENT_TOKEN = Symbol("IChatwootClient");
