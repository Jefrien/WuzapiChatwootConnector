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
  message_type: z.enum(["incoming", "outgoing", "activity"]).optional(),
  id: z.number().optional(),
  content: z.string().optional(),
  content_type: z.string().optional(),
  private: z.boolean().optional(),
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
        .optional(),
    })
    .optional(),
  sender: z
    .object({
      id: z.number(),
      name: z.string(),
      email: z.string().optional(),
      phone_number: z.string().optional(),
      thumbnail: z.string().optional(),
    })
    .optional(),
  attachments: z
    .array(
      z.object({
        id: z.number(),
        account_id: z.number(),
        message_id: z.number(),
        file_type: z.string(),
        file_size: z.number(),
        data_url: z.string().optional(),
        thumb_url: z.string().optional(),
        extension: z.string().optional(),
      })
    )
    .optional(),
  content_attributes: z.any().optional(),
});
