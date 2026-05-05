import { config } from "dotenv";
import { z } from "zod";

config();

const envSchema = z.object({
  PORT: z.string().default("3000").transform(Number),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),

  WUZAPI_BASE_URL: z.string().url(),
  WUZAPI_TOKEN: z.string().min(1),

  CHATWOOT_BASE_URL: z.string().url(),
  CHATWOOT_ACCOUNT_ID: z.string().transform(Number),
  CHATWOOT_INBOX_ID: z.string().transform(Number),
  CHATWOOT_API_TOKEN: z.string().min(1),
  CHATWOOT_INBOX_IDENTIFIER: z.string().min(1),

  CONNECTOR_WEBHOOK_SECRET: z.string().optional(),
  PUBLIC_URL: z.preprocess(
    (val) => (val === "" ? undefined : val),
    z.string().url().optional()
  ),
});

export type EnvConfig = z.infer<typeof envSchema>;

export const env = envSchema.parse(process.env);
