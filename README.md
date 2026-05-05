# Chatwoot <> Wuzapi Connector

Un conector bidireccional entre **Wuzapi** (API REST para WhatsApp) y **Chatwoot** (plataforma de conversaciones omnicanal), construido con **Hono.js** siguiendo principios **SOLID**.

## Arquitectura

```
src/
├── config/                 # Configuración centralizada (variables de entorno)
├── domain/
│   └── types/              # Tipos y entidades del dominio (Chatwoot, Wuzapi)
├── application/
│   ├── ports/              # Interfaces (puertos) - contratos para infraestructura
│   └── use-cases/          # Casos de uso (lógica de negocio pura)
├── infrastructure/
│   ├── clients/            # Implementaciones HTTP de APIs externas
│   └── persistence/        # Repositorios (SQLite con better-sqlite3)
├── interfaces/
│   └── controllers/        # Controllers HTTP (Hono)
├── di/
│   └── container.ts        # Container de Inyección de Dependencias (tsyringe)
└── index.ts                # Punto de entrada
```

### Principios SOLID aplicados

- **S**ingle Responsibility: Cada clase tiene una única razón para cambiar.
- **O**pen/Closed: Los casos de uso dependen de abstracciones (ports), permitiendo extender sin modificar.
- **L**iskov Substitution: Los repositorios y clientes son intercambiables mediante sus interfaces.
- **I**nterface Segregation: Puertos pequeños y específicos (`IChatwootClient`, `IWuzapiClient`, `IMessageMappingRepository`).
- **D**ependency Inversion: La capa de aplicación depende de abstracciones, no de implementaciones concretas.

## Flujo de Mensajes

### WhatsApp → Chatwoot (Inbound)

1. Wuzapi recibe un mensaje de WhatsApp y envía un webhook a `/webhooks/wuzapi`
2. `ProcessIncomingMessageUseCase`:
   - Extrae el chat ID y teléfono del remitente
   - Busca o crea el contacto en Chatwoot
   - Busca o crea la conversación en Chatwoot
   - Envía el mensaje (con media base64 si aplica) a Chatwoot
   - Guarda el mapeo en SQLite

### Chatwoot → WhatsApp (Outbound)

1. Un agente responde en Chatwoot, el cual envía un webhook a `/webhooks/chatwoot`
2. `ProcessOutgoingMessageUseCase`:
   - Valida que sea un mensaje saliente (`outgoing`)
   - Extrae el teléfono del contacto
   - Resuelve el `reply_to` si existe (mediante el mapping repository)
   - Envía el mensaje a Wuzapi (texto o media)
   - Guarda el mapeo en SQLite

## Requisitos

- Node.js >= 18
- npm o pnpm

## Guía de Configuración Completa

📖 **[Ver SETUP.md para la guía paso a paso detallada](SETUP.md)**

### Resumen rápido

1. **Crear inbox en Chatwoot**: Tipo **API**, copiar `Inbox Identifier`
2. **Obtener credenciales de Chatwoot**: `Account ID`, `Inbox ID`, `API Access Token`
3. **Obtener credenciales de Wuzapi**: Token de usuario
4. **Configurar `.env`** con todas las variables
5. **Exponer el conector a internet** (Ngrok o servidor con dominio)
6. **Configurar webhooks** en Wuzapi y Chatwoot
7. **Conectar WhatsApp** en Wuzapi vía QR
8. **Probar** enviando mensajes de WhatsApp a Chatwoot y respondiendo desde Chatwoot

## Instalación

```bash
# Clonar o copiar el proyecto
cd chatwoot-wuzapi-connector

# Instalar dependencias
npm install

# Copiar y configurar variables de entorno
cp .env.example .env
# Editar .env con tus credenciales - VER SETUP.md
```

## Variables de Entorno

| Variable | Descripción | Ejemplo |
|----------|-------------|---------|
| `PORT` | Puerto del servidor | `3000` |
| `WUZAPI_BASE_URL` | URL base de tu instancia Wuzapi | `https://wuz.jefrien.dev` |
| `WUZAPI_TOKEN` | Token de usuario de Wuzapi | `abc123` |
| `CHATWOOT_BASE_URL` | URL base de Chatwoot | `https://chatwoot.tudominio.com` |
| `CHATWOOT_ACCOUNT_ID` | ID de la cuenta | `1` |
| `CHATWOOT_INBOX_ID` | ID del inbox de WhatsApp | `2` |
| `CHATWOOT_API_TOKEN` | Token de acceso de la cuenta | `tu_token` |
| `CHATWOOT_INBOX_IDENTIFIER` | Identificador del inbox (público) | `abc-def-123` |
| `CONNECTOR_WEBHOOK_SECRET` | (Opcional) Secret para verificar webhooks | `secreto` |
| `PUBLIC_URL` | (Opcional) URL pública para auto-configurar webhook de Wuzapi | `https://tuconector.com` |

## Uso

### Desarrollo

```bash
npm run dev
```

### Producción

```bash
npm run build
npm start
```

### Endpoints

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/health` | Health check |
| POST | `/webhooks/wuzapi` | Webhook para eventos de Wuzapi |
| POST | `/webhooks/chatwoot` | Webhook para eventos de Chatwoot |

## Configuración de Webhooks

### 1. Configurar webhook de Wuzapi

Opción A (Auto): Define la variable `PUBLIC_URL` en el `.env`. El conector configurará automáticamente el webhook al iniciar.

Opción B (Manual):
```bash
curl -X POST https://wuz.jefrien.dev/webhook \
  -H "token: TU_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"webhook": "https://tu-conector.com/webhooks/wuzapi", "events": ["Message", "ReadReceipt"]}'
```

### 2. Configurar webhook de Chatwoot

En la configuración del inbox de Chatwoot:
- Webhook URL: `https://tu-conector.com/webhooks/chatwoot`
- Suscribirse a eventos: `message_created`, `message_updated`

## Tipos de Mensajes Soportados

### Inbound (WA → CW)
- ✅ Texto
- ✅ Imagen (con caption)
- ✅ Video (con caption)
- ✅ Audio
- ✅ Documento
- ✅ Sticker
- ✅ Contacto
- ✅ Ubicación
- ✅ Reacciones
- ✅ Mensajes eliminados

### Outbound (CW → WA)
- ✅ Texto
- ✅ Imagen
- ✅ Video
- ✅ Audio
- ✅ Documento genérico
- ✅ Reply-to (respuestas citadas)

## Base de Datos

El conector usa **SQLite** para persistir el mapeo de mensajes entre sistemas. Esto permite:
- Responder mensajes citados correctamente
- Evitar duplicados
- Auditar el flujo de mensajes

Ubicación por defecto: `./data/mappings.db`

## Extensión

Para agregar soporte a nuevos tipos de mensajes o eventos:

1. **Dominio**: Agrega el tipo en `src/domain/types/`
2. **Puertos**: Define la interfaz en `src/application/ports/`
3. **Caso de uso**: Implementa la lógica en `src/application/use-cases/`
4. **Infraestructura**: Implementa el cliente/repositorio
5. **Controller**: Expón el endpoint en `src/interfaces/controllers/`

## Inspiración

Basado en la integración de [WAHA](https://github.com/devlikeapro/waha/tree/core/src/apps/chatwoot) con Chatwoot.

## Licencia

MIT
