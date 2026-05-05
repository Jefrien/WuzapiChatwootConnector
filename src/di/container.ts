import "reflect-metadata";
import { container } from "tsyringe";
import { CHATWOOT_CLIENT_TOKEN } from "../application/ports/chatwoot-client.port";
import { WUZAPI_CLIENT_TOKEN } from "../application/ports/wuzapi-client.port";
import { MESSAGE_MAPPING_REPOSITORY_TOKEN } from "../application/ports/message-mapping.repository.port";
import { ChatwootClient } from "../infrastructure/clients/chatwoot.client";
import { WuzapiClient } from "../infrastructure/clients/wuzapi.client";
import { MessageMappingRepository } from "../infrastructure/persistence/message-mapping.repository";

export function registerDependencies(): void {
  container.register(CHATWOOT_CLIENT_TOKEN, { useClass: ChatwootClient });
  container.register(WUZAPI_CLIENT_TOKEN, { useClass: WuzapiClient });
  container.register(MESSAGE_MAPPING_REPOSITORY_TOKEN, {
    useClass: MessageMappingRepository,
  });
}

export { container };
