import { z } from "zod";

export const wuzapiWebhookSchema = z.object({
  type: z.string(),
  event: z.any().optional(),
  userID: z.string().optional(),
  instanceName: z.string().optional(),
  jsonData: z.string().optional(),
  base64: z.string().optional(),
  mimeType: z.string().optional(),
  fileName: z.string().optional(),
  s3: z.any().optional(),
});

export const chatwootWebhookSchema = z.object({
  event: z.string(),
  message_type: z.enum(["incoming", "outgoing", "activity"]).optional().nullable(),
  id: z.number().optional().nullable(),
  content: z.string().optional().nullable(),
  content_type: z.string().optional().nullable(),
  private: z.boolean().optional().nullable(),
  conversation: z
    .object({
      id: z.number(),
      account_id: z.number(),
      inbox_id: z.number(),
      status: z.string(),
      contact_inbox: z
        .object({
          source_id: z.string(),
        })
        .optional()
        .nullable(),
    })
    .optional()
    .nullable(),
  sender: z
    .object({
      id: z.number(),
      name: z.string(),
      email: z.string().optional().nullable(),
      phone_number: z.string().optional().nullable(),
      thumbnail: z.string().optional().nullable(),
    })
    .optional()
    .nullable(),
  attachments: z
    .array(
      z.object({
        id: z.number(),
        account_id: z.number(),
        message_id: z.number(),
        file_type: z.string(),
        file_size: z.number(),
        data_url: z.string().optional().nullable(),
        thumb_url: z.string().optional().nullable(),
        extension: z.string().optional().nullable(),
      })
    )
    .optional()
    .nullable(),
  content_attributes: z.any().optional().nullable(),
}).passthrough(); // Allow extra fields from Chatwoot
