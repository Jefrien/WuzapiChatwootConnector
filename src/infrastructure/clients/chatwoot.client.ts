import { injectable } from "tsyringe";
import { env } from "../../config";
import type { IChatwootClient, CreateContactResult } from "../../application/ports/chatwoot-client.port";
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
    this.baseUrl = env.CHATWOOT_BASE_URL.replace(/\/$/, ""); // trim trailing slash
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
    console.log(`[Chatwoot] Account API -> ${url}`);
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
    console.log(`[Chatwoot] Public API -> ${url}`);
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

  async createContact(payload: ChatwootCreateContactPayload): Promise<CreateContactResult> {
    try {
      // Try public inbox API first (creates contact already linked to inbox)
      // Public API returns directly: { source_id, pubsub_token, id, name, email, phone_number, ... }
      const publicResult = await this.publicRequest<{
        source_id: string;
        pubsub_token: string;
        id: number;
        name: string;
        email: string | null;
        phone_number: string | null;
        thumbnail?: string;
        custom_attributes?: Record<string, string>;
        contact_inboxes?: Array<{ source_id: string; inbox: { id: number } }>;
      }>("/contacts", {
        method: "POST",
        body: JSON.stringify({
          name: payload.name,
          email: payload.email,
          identifier: payload.identifier,
          avatar_url: payload.avatar_url,
          custom_attributes: payload.custom_attributes,
          // Note: phone_number excluded from Client API to avoid E164 validation issues
        }),
      });

      // Build contact from public result + enrich with account API
      const baseContact: ChatwootContact = {
        id: publicResult.id,
        name: publicResult.name,
        email: publicResult.email || undefined,
        phone_number: publicResult.phone_number || undefined,
        thumbnail: publicResult.thumbnail,
        custom_attributes: publicResult.custom_attributes,
        contact_inboxes: publicResult.contact_inboxes,
      };

      // Enrich with account API to get full contact data
      try {
        const fullContact = await this.accountRequest<{ payload: ChatwootContact }>(
          `/accounts/${this.accountId}/contacts/${publicResult.id}`
        );
        return {
          contact: fullContact.payload,
          sourceId: publicResult.source_id,
        };
      } catch {
        // If account API fails, use base contact
        return {
          contact: baseContact,
          sourceId: publicResult.source_id,
        };
      }
    } catch (publicError) {
      console.warn("[Chatwoot] Public API failed, falling back to Account API:", publicError);

      // Fallback: use account API to create contact
      const accountResult = await this.accountRequest<
        { payload: ChatwootContact } | ChatwootContact
      >(
        `/accounts/${this.accountId}/contacts`,
        {
          method: "POST",
          body: JSON.stringify({
            inbox_id: this.inboxId,
            name: payload.name,
            phone_number: payload.phone_number,
            email: payload.email,
            identifier: payload.identifier,
            avatar_url: payload.avatar_url,
            custom_attributes: payload.custom_attributes,
          }),
        }
      );

      const contact = ((accountResult as any).payload || accountResult) as ChatwootContact;

      // Get source_id from contact_inboxes
      const sourceId = contact.contact_inboxes?.find(
        (ci: { inbox: { id: number }; source_id: string }) => ci.inbox.id === this.inboxId
      )?.source_id;

      if (!sourceId) {
        throw new Error(`Contact created but no source_id found for inbox ${this.inboxId}`);
      }

      return { contact, sourceId };
    }
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
      // Include resolved conversations so we can reopen them
      const conversation = result.payload?.find(
        (c) => c.inbox_id === this.inboxId
      );
      return conversation || null;
    } catch {
      return null;
    }
  }

  async createConversation(contactSourceId: string): Promise<ChatwootConversation> {
    try {
      const result = await this.publicRequest<ChatwootConversation>(
        `/contacts/${contactSourceId}/conversations`,
        {
          method: "POST",
          body: JSON.stringify({}),
        }
      );
      return result;
    } catch (publicError) {
      console.warn("[Chatwoot] Public API createConversation failed, using Account API:", publicError);

      const result = await this.accountRequest<
        { payload: ChatwootConversation } | ChatwootConversation
      >(
        `/accounts/${this.accountId}/conversations`,
        {
          method: "POST",
          body: JSON.stringify({
            source_id: contactSourceId,
            inbox_id: this.inboxId,
            status: "open",
          }),
        }
      );
      const conversation = (result as any).payload || result;
      if (!conversation || !conversation.id) {
        console.error("[Chatwoot] Unexpected createConversation response:", JSON.stringify(result));
        throw new Error("createConversation returned invalid response");
      }
      return conversation as ChatwootConversation;
    }
  }

  async updateConversationStatus(
    conversationId: number,
    status: "open" | "pending" | "resolved" | "snoozed"
  ): Promise<void> {
    await this.accountRequest(
      `/accounts/${this.accountId}/conversations/${conversationId}`,
      {
        method: "PATCH",
        body: JSON.stringify({ status }),
      }
    );
  }

  async updateConversationCustomAttributes(
    conversationId: number,
    attributes: Record<string, string | number | boolean | null>
  ): Promise<void> {
    await this.accountRequest(
      `/accounts/${this.accountId}/conversations/${conversationId}/custom_attributes`,
      {
        method: "POST",
        body: JSON.stringify({ custom_attributes: attributes }),
      }
    );
  }

  async createMessage(
    conversationId: number,
    payload: ChatwootCreateMessagePayload,
    accountId?: number
  ): Promise<{ id: number; content: string }> {
    const effectiveAccountId = accountId ?? this.accountId;
    const url = `${this.baseUrl}/api/v1/accounts/${effectiveAccountId}/conversations/${conversationId}/messages`;
    console.log(`[Chatwoot] Account API -> ${url}`);

    let response: Response;

    if (payload.attachments && payload.attachments.length > 0) {
      // Use multipart/form-data for attachments (Chatwoot requires this)
      const formData = new FormData();
      formData.append("content", payload.content);
      formData.append("message_type", payload.message_type || "incoming");
      formData.append("private", String(payload.private || false));

      for (const attachment of payload.attachments) {
        const buffer = Buffer.from(attachment.content, "base64");
        const blob = new Blob([buffer], {
          type: this.getMimeTypeFromFilename(attachment.filename),
        });
        formData.append("attachments[]", blob, attachment.filename);
      }

      response = await fetch(url, {
        method: "POST",
        headers: {
          "Api-Access-Token": this.apiToken,
        },
        body: formData,
      });
    } else {
      response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Api-Access-Token": this.apiToken,
        },
        body: JSON.stringify(payload),
      });
    }

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Chatwoot API error ${response.status}: ${text}`);
    }

    const result = await response.json() as
      | { payload: { id: number; content: string } }
      | { id: number; content: string };

    const message = (result as any).payload || result;
    if (!message || !message.id) {
      console.error("[Chatwoot] Unexpected createMessage response:", JSON.stringify(result));
      throw new Error("createMessage returned invalid response");
    }
    return message as { id: number; content: string };
  }

  private getMimeTypeFromFilename(filename: string): string {
    const ext = filename.split(".").pop()?.toLowerCase();
    switch (ext) {
      case "jpg":
      case "jpeg":
        return "image/jpeg";
      case "png":
        return "image/png";
      case "gif":
        return "image/gif";
      case "webp":
        return "image/webp";
      case "mp4":
        return "video/mp4";
      case "ogg":
        return "audio/ogg";
      case "mp3":
        return "audio/mpeg";
      case "pdf":
        return "application/pdf";
      default:
        return "application/octet-stream";
    }
  }

  async getMessages(
    conversationId: number,
    accountId?: number,
    before?: number
  ): Promise<any[]> {
    const effectiveAccountId = accountId ?? this.accountId;
    let url = `${this.baseUrl}/api/v1/accounts/${effectiveAccountId}/conversations/${conversationId}/messages`;
    if (before) {
      url += `?before=${before}`;
    }
    console.log(`[Chatwoot] Account API -> ${url}`);

    const response = await fetch(url, {
      headers: {
        "Api-Access-Token": this.apiToken,
      },
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Chatwoot API error ${response.status}: ${text}`);
    }

    const data = await response.json() as any;
    // Chatwoot returns { payload: [...] } or [...] depending on version
    return data?.payload || data || [];
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
