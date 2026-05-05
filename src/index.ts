import "reflect-metadata";
import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { env } from "./config";
import { registerDependencies } from "./di/container";
import { wuzapiWebhookController } from "./interfaces/controllers/wuzapi-webhook.controller";
import { chatwootWebhookController } from "./interfaces/controllers/chatwoot-webhook.controller";
import { SetupWebhookUseCase } from "./application/use-cases/setup-webhook.use-case";
import { container } from "tsyringe";

async function main() {
  // Register DI dependencies
  registerDependencies();

  const app = new Hono();

  // Health check
  app.get("/health", (c) =>
    c.json({
      status: "ok",
      timestamp: new Date().toISOString(),
      service: "chatwoot-wuzapi-connector",
    })
  );

  // Mount webhook controllers
  app.route("/webhooks", wuzapiWebhookController);
  app.route("/webhooks", chatwootWebhookController);

  // Start server
  const port = env.PORT;
  serve({
    fetch: app.fetch,
    port,
  });

  console.log(`🚀 Connector running on http://localhost:${port}`);
  console.log(`📡 Wuzapi webhook endpoint: http://localhost:${port}/webhooks/wuzapi`);
  console.log(`💬 Chatwoot webhook endpoint: http://localhost:${port}/webhooks/chatwoot`);

  // Auto-setup Wuzapi webhook if configured
  try {
    const publicUrl = process.env.PUBLIC_URL;
    if (publicUrl) {
      const setupUseCase = container.resolve(SetupWebhookUseCase);
      const success = await setupUseCase.execute(`${publicUrl}/webhooks/wuzapi`);
      if (success) {
        console.log("✅ Wuzapi webhook auto-configured");
      } else {
        console.warn("⚠️ Failed to auto-configure Wuzapi webhook");
      }
    } else {
      console.log("ℹ️ Set PUBLIC_URL env var to auto-configure Wuzapi webhook");
    }
  } catch (error) {
    console.error("Failed to setup webhook:", error);
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
