import { injectable } from "tsyringe";
import { env } from "../../config";
import type { IChatwootClient } from "../../application/ports/chatwoot-client.port";
import type {
  ChatwootContact,
  ChatwootConversation,
  ChatwootCreateContactPayload,
  ChatwootCreateMessagePayload,
} from "../../domain/types/chatwoot";

@injectable()
export class ChatwootClient implements IChatwootClient {
  private readonly baseUrl: string;
  private readonly accountId: number;
  private readonly inboxId: number;
  private readonly apiToken: string;
  private readonly inboxIdentifier: string;

  constructor() {
    this.baseUrl = env.CHATWOOT_BASE_URL;
    this.accountId = env.CHATWOOT_ACCOUNT_ID;
    this.inboxId = env.CHATWOOT_INBOX_ID;
    this.apiToken = env.CHATWOOT_API_TOKEN;
    this.inboxIdentifier = env.CHATWOOT_INBOX_IDENTIFIER;
  }

  private async accountRequest<T>(
    path: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}/api/v1${path}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        "Api-Access-Token": this.apiToken,
        ...options.headers,
      },
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Chatwoot API error ${response.status}: ${text}`);
    }

    if (response.status === 204) {
      return undefined as T;
    }

    return response.json() as Promise<T>;
  }

  private async publicRequest<T>(
    path: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}/public/api/v1/inboxes/${this.inboxIdentifier}${path}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Chatwoot Public API error ${response.status}: ${text}`);
    }

    if (response.status === 204) {
      return undefined as T;
    }

    return response.json() as Promise<T>;
  }

  async findContactByPhone(phone: string): Promise<ChatwootContact | null> {
    try {
      const cleanPhone = phone.replace(/\+/g, "");
      const result = await this.accountRequest<{ payload: ChatwootContact[] }>(
        `/accounts/${this.accountId}/contacts/search?q=${encodeURIComponent(cleanPhone)}`
      );
      const contact = result.payload?.[0];
      if (!contact) return null;
      const hasInbox = contact.contact_inboxes?.some(
        (ci) => ci.inbox.id === this.inboxId
      );
      return hasInbox ? contact : null;
    } catch {
      return null;
    }
  }

  async findContactByIdentifier(identifier: string): Promise<ChatwootContact | null> {
    try {
      const result = await this.accountRequest<{ payload: ChatwootContact[] }>(
        `/accounts/${this.accountId}/contacts/search?q=${encodeURIComponent(identifier)}`
      );
      const contact = result.payload?.find(
        (c) => c.custom_attributes?.whatsapp_chat_id === identifier
      );
      if (!contact) return null;
      const hasInbox = contact.contact_inboxes?.some(
        (ci) => ci.inbox.id === this.inboxId
      );
      return hasInbox ? contact : null;
    } catch {
      return null;
    }
  }

  async createContact(payload: ChatwootCreateContactPayload): Promise<ChatwootContact> {
    // Use public inbox API to create contact already linked to the inbox
    const result = await this.publicRequest<{
      payload: {
        contact: ChatwootContact;
        contact_inbox: { source_id: string };
      };
    }>("/contacts", {
      method: "POST",
      body: JSON.stringify({
        name: payload.name,
        phone_number: payload.phone_number,
        email: payload.email,
        identifier: payload.identifier,
        avatar_url: payload.avatar_url,
        custom_attributes: payload.custom_attributes,
      }),
    });

    // Enrich with account API to get full contact data
    const fullContact = await this.accountRequest<{ payload: ChatwootContact }>(
      `/accounts/${this.accountId}/contacts/${result.payload.contact.id}`
    );

    return fullContact.payload;
  }

  async updateContactAttributes(
    contactId: number,
    attributes: Record<string, string>
  ): Promise<void> {
    await this.accountRequest(
      `/accounts/${this.accountId}/contacts/${contactId}`,
      {
        method: "PUT",
        body: JSON.stringify({ custom_attributes: attributes }),
      }
    );
  }

  async updateContactAvatar(contactId: number, avatarUrl: string): Promise<void> {
    await this.accountRequest(
      `/accounts/${this.accountId}/contacts/${contactId}`,
      {
        method: "PUT",
        body: JSON.stringify({ avatar_url: avatarUrl }),
      }
    );
  }

  async findConversationByContactId(contactId: number): Promise<ChatwootConversation | null> {
    try {
      const result = await this.accountRequest<{ payload: ChatwootConversation[] }>(
        `/accounts/${this.accountId}/contacts/${contactId}/conversations`
      );
      const conversation = result.payload?.find(
        (c) => c.inbox_id === this.inboxId && c.status !== "resolved"
      );
      return conversation || null;
    } catch {
      return null;
    }
  }

  async createConversation(contactSourceId: string): Promise<ChatwootConversation> {
    const result = await this.publicRequest<{
      payload: ChatwootConversation;
    }>(`/contacts/${contactSourceId}/conversations`, {
      method: "POST",
      body: JSON.stringify({}),
    });
    return result.payload;
  }

  async createMessage(
    conversationId: number,
    payload: ChatwootCreateMessagePayload
  ): Promise<{ id: number; content: string }> {
    const result = await this.accountRequest<{ payload: { id: number; content: string } }>(
      `/accounts/${this.accountId}/conversations/${conversationId}/messages`,
      {
        method: "POST",
        body: JSON.stringify(payload),
      }
    );
    return result.payload;
  }

  async markConversationAsRead(conversationId: number, sourceId: string): Promise<void> {
    try {
      await fetch(
        `${this.baseUrl}/public/api/v1/inboxes/${this.inboxIdentifier}/contacts/${sourceId}/conversations/${conversationId}/update_last_seen`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        }
      );
    } catch (error) {
      console.error("Failed to mark conversation as read:", error);
    }
  }
}
