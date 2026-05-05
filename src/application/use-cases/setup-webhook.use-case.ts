import { inject, injectable } from "tsyringe";
import {
  WUZAPI_CLIENT_TOKEN,
  type IWuzapiClient,
} from "../ports/wuzapi-client.port";

@injectable()
export class SetupWebhookUseCase {
  constructor(
    @inject(WUZAPI_CLIENT_TOKEN)
    private readonly wuzapiClient: IWuzapiClient,
  ) {}

  async execute(connectorWebhookUrl: string): Promise<boolean> {
    try {
      const result = await this.wuzapiClient.setWebhook(connectorWebhookUrl, [
        "Message",
        "ReadReceipt",
      ]);
      console.log("WebookSet", result, connectorWebhookUrl);
      return result.success;
    } catch (error) {
      console.error("Failed to setup Wuzapi webhook:", error);
      return false;
    }
  }
}
