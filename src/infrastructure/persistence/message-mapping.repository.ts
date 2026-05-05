import Database from "better-sqlite3";
import { injectable } from "tsyringe";
import type {
  IMessageMappingRepository,
  MessageMapping,
} from "../../application/ports/message-mapping.repository.port";

@injectable()
export class MessageMappingRepository implements IMessageMappingRepository {
  private db: Database.Database;

  constructor(dbPath: string = "./data/mappings.db") {
    this.db = new Database(dbPath);
    this.init();
  }

  private init(): void {
    // Create table with nullable chatwoot_contact_id
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS message_mappings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        wuzapi_message_id TEXT NOT NULL,
        chatwoot_message_id INTEGER NOT NULL,
        chatwoot_conversation_id INTEGER NOT NULL,
        wuzapi_phone TEXT NOT NULL,
        chatwoot_contact_id INTEGER,
        direction TEXT NOT NULL CHECK(direction IN ('inbound', 'outbound')),
        part INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_wuzapi_msg ON message_mappings(wuzapi_message_id);
      CREATE INDEX IF NOT EXISTS idx_chatwoot_msg ON message_mappings(chatwoot_message_id);
      CREATE INDEX IF NOT EXISTS idx_conv_part ON message_mappings(chatwoot_conversation_id, part);
    `);

    // Migrate old table if chatwoot_contact_id has NOT NULL constraint
    this.migrateContactIdToNullable();
  }

  private migrateContactIdToNullable(): void {
    const tableInfo = this.db.pragma("table_info(message_mappings)") as Array<{
      name: string;
      type: string;
      notnull: number;
      dflt_value: string | null;
      pk: number;
    }>;

    const contactIdCol = tableInfo.find((col) => col.name === "chatwoot_contact_id");
    if (contactIdCol && contactIdCol.notnull === 1) {
      console.log("[DB] Migrating chatwoot_contact_id to nullable...");
      this.db.exec(`
        BEGIN TRANSACTION;
        CREATE TABLE message_mappings_new (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          wuzapi_message_id TEXT NOT NULL,
          chatwoot_message_id INTEGER NOT NULL,
          chatwoot_conversation_id INTEGER NOT NULL,
          wuzapi_phone TEXT NOT NULL,
          chatwoot_contact_id INTEGER,
          direction TEXT NOT NULL CHECK(direction IN ('inbound', 'outbound')),
          part INTEGER DEFAULT 1,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
        INSERT INTO message_mappings_new
          (id, wuzapi_message_id, chatwoot_message_id, chatwoot_conversation_id, wuzapi_phone, chatwoot_contact_id, direction, part, created_at)
        SELECT
          id, wuzapi_message_id, chatwoot_message_id, chatwoot_conversation_id, wuzapi_phone, chatwoot_contact_id, direction, part, created_at
        FROM message_mappings;
        DROP TABLE message_mappings;
        ALTER TABLE message_mappings_new RENAME TO message_mappings;
        CREATE INDEX IF NOT EXISTS idx_wuzapi_msg ON message_mappings(wuzapi_message_id);
        CREATE INDEX IF NOT EXISTS idx_chatwoot_msg ON message_mappings(chatwoot_message_id);
        CREATE INDEX IF NOT EXISTS idx_conv_part ON message_mappings(chatwoot_conversation_id, part);
        COMMIT;
      `);
      console.log("[DB] Migration completed.");
    }
  }

  async save(
    mapping: Omit<MessageMapping, "id" | "createdAt">
  ): Promise<MessageMapping> {
    const stmt = this.db.prepare(`
      INSERT INTO message_mappings
        (wuzapi_message_id, chatwoot_message_id, chatwoot_conversation_id, wuzapi_phone, chatwoot_contact_id, direction, part)
      VALUES
        (@wuzapiMessageId, @chatwootMessageId, @chatwootConversationId, @wuzapiPhone, @chatwootContactId, @direction, @part)
    `);

    const result = stmt.run({
      wuzapiMessageId: mapping.wuzapiMessageId,
      chatwootMessageId: mapping.chatwootMessageId,
      chatwootConversationId: mapping.chatwootConversationId,
      wuzapiPhone: mapping.wuzapiPhone,
      chatwootContactId: mapping.chatwootContactId,
      direction: mapping.direction,
      part: mapping.part ?? 1,
    });

    return {
      ...mapping,
      id: Number(result.lastInsertRowid),
      createdAt: new Date(),
    };
  }

  async findByWuzapiId(wuzapiMessageId: string): Promise<MessageMapping | null> {
    const row = this.db
      .prepare("SELECT * FROM message_mappings WHERE wuzapi_message_id = ?")
      .get(wuzapiMessageId) as Record<string, unknown> | undefined;
    return row ? this.mapRow(row) : null;
  }

  async findByChatwootId(chatwootMessageId: number): Promise<MessageMapping | null> {
    const row = this.db
      .prepare("SELECT * FROM message_mappings WHERE chatwoot_message_id = ?")
      .get(chatwootMessageId) as Record<string, unknown> | undefined;
    return row ? this.mapRow(row) : null;
  }

  async findByConversationAndPart(
    conversationId: number,
    part: number
  ): Promise<MessageMapping | null> {
    const row = this.db
      .prepare(
        "SELECT * FROM message_mappings WHERE chatwoot_conversation_id = ? AND part = ?"
      )
      .get(conversationId, part) as Record<string, unknown> | undefined;
    return row ? this.mapRow(row) : null;
  }

  async findLatestByConversation(conversationId: number): Promise<MessageMapping | null> {
    const row = this.db
      .prepare(
        "SELECT * FROM message_mappings WHERE chatwoot_conversation_id = ? ORDER BY created_at DESC LIMIT 1"
      )
      .get(conversationId) as Record<string, unknown> | undefined;
    return row ? this.mapRow(row) : null;
  }

  private mapRow(row: Record<string, unknown>): MessageMapping {
    return {
      id: Number(row.id),
      wuzapiMessageId: String(row.wuzapi_message_id),
      chatwootMessageId: Number(row.chatwoot_message_id),
      chatwootConversationId: Number(row.chatwoot_conversation_id),
      wuzapiPhone: String(row.wuzapi_phone),
      chatwootContactId: row.chatwoot_contact_id ? Number(row.chatwoot_contact_id) : undefined,
      direction: String(row.direction) as "inbound" | "outbound",
      part: Number(row.part),
      createdAt: new Date(String(row.created_at)),
    };
  }
}
