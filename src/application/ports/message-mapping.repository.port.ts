export interface MessageMapping {
  id?: number;
  wuzapiMessageId: string;
  chatwootMessageId: number;
  chatwootConversationId: number;
  wuzapiPhone: string;
  chatwootContactId?: number;
  direction: "inbound" | "outbound";
  part?: number;
  createdAt: Date;
}

export interface IMessageMappingRepository {
  save(mapping: Omit<MessageMapping, "id" | "createdAt">): Promise<MessageMapping>;
  findByWuzapiId(wuzapiMessageId: string): Promise<MessageMapping | null>;
  findByChatwootId(chatwootMessageId: number): Promise<MessageMapping | null>;
  findByConversationAndPart(conversationId: number, part: number): Promise<MessageMapping | null>;
  findLatestByConversation(conversationId: number): Promise<MessageMapping | null>;
}

export const MESSAGE_MAPPING_REPOSITORY_TOKEN = Symbol("IMessageMappingRepository");
