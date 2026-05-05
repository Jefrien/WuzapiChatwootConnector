# Guía de Configuración Paso a Paso

Esta guía te lleva de la mano para configurar el conector entre **Wuzapi** (WhatsApp) y **Chatwoot** (CRM/Conversaciones).

---

## Paso 1: Crear un Inbox en Chatwoot

1. Ingresa a tu panel de Chatwoot como administrador
2. Ve a **Configuración** → **Inboxes** → **Add Inbox**
3. Selecciona **API** como canal
4. Completa los datos:
   - **Name**: `WhatsApp - Wuzapi`
   - **Webhook URL**: (déjalo vacío por ahora, lo llenaremos después)
5. Guarda el inbox

### Obtener el `Inbox Identifier`

1. Entra al inbox que acabas de crear
2. Ve a la pestaña **Configuration**
3. Copia el valor de **Inbox Identifier** (se ve como un UUID: `abc123-def456...`)
4. Este valor lo usarás en la variable `CHATWOOT_INBOX_IDENTIFIER`

### Obtener el `Account ID` e `Inbox ID`

La URL del inbox se ve algo así:
```
https://chatwoot.tudominio.com/app/accounts/1/inbox/3
```
- `1` es tu **Account ID**
- `3` es tu **Inbox ID**

### Obtener el `API Access Token`

1. En Chatwoot, haz clic en tu avatar (arriba a la izquierda)
2. Ve a **Profile Settings**
3. Ve a la pestaña **Access Tokens**
4. Copia el token (o genera uno nuevo)
5. Este es tu `CHATWOOT_API_TOKEN`

---

## Paso 2: Configurar Wuzapi

### Obtener tu token de Wuzapi

1. Accede al dashboard de Wuzapi: `https://wuz.jefrien.dev/dashboard`
2. Crea un usuario si no tienes uno
3. Copia el **token** del usuario
4. Este es tu `WUZAPI_TOKEN`

### Obtener la URL base

- Si usas la instancia del usuario: `https://wuz.jefrien.dev`
- Si tienes tu propia instancia: usa esa URL

---

## Paso 3: Configurar el Conector

1. Copia el archivo de ejemplo:
```bash
cp .env.example .env
```

2. Edita el archivo `.env` con tus datos:

```env
PORT=3000
NODE_ENV=development

# Wuzapi
WUZAPI_BASE_URL=https://wuz.jefrien.dev
WUZAPI_TOKEN=tu_token_de_wuzapi

# Chatwoot
CHATWOOT_BASE_URL=https://chatwoot.tudominio.com
CHATWOOT_ACCOUNT_ID=1
CHATWOOT_INBOX_ID=3
CHATWOOT_API_TOKEN=tu_token_de_chatwoot
CHATWOOT_INBOX_IDENTIFIER=abc123-def456-ghi789

# Opcional: para auto-configurar el webhook de Wuzapi al iniciar
PUBLIC_URL=https://tu-conector.com
```

3. Instala dependencias e inicia:
```bash
npm install
npm run dev
```

Deberías ver:
```
🚀 Connector running on http://localhost:3000
📡 Wuzapi webhook endpoint: http://localhost:3000/webhooks/wuzapi
💬 Chatwoot webhook endpoint: http://localhost:3000/webhooks/chatwoot
```

---

## Paso 4: Exponer el conector a internet

Chatwoot y Wuzapi necesitan enviar webhooks a tu conector, así que debe estar accesible desde internet.

### Opción A: Ngrok (para desarrollo/pruebas)

```bash
npx ngrok http 3000
```

Copia la URL HTTPS (ej: `https://abc123.ngrok-free.app`) y úsala como `PUBLIC_URL`.

### Opción B: Servidor propio / VPS

Si tienes el conector en un VPS o servidor con dominio, usa esa URL.

---

## Paso 5: Configurar Webhook de Wuzapi

### Opción automática (recomendada)

Si configuraste `PUBLIC_URL` en el `.env`, el conector configura automáticamente el webhook de Wuzapi al iniciar.

Verás en los logs:
```
✅ Wuzapi webhook auto-configured
```

### Opción manual

```bash
curl -X POST https://wuz.jefrien.dev/webhook \
  -H "token: TU_TOKEN_DE_WUZAPI" \
  -H "Content-Type: application/json" \
  -d '{
    "webhook": "https://tu-conector.com/webhooks/wuzapi",
    "events": ["Message", "ReadReceipt"]
  }'
```

---

## Paso 6: Configurar Webhook de Chatwoot

1. Ve a tu inbox en Chatwoot
2. Ve a la pestaña **Configuration**
3. En **Webhook URL**, pon:
   ```
   https://tu-conector.com/webhooks/chatwoot
   ```
4. En **Subscribe to events**, selecciona:
   - ✅ `message_created`
   - ✅ `message_updated`
5. Guarda los cambios

---

## Paso 7: Conectar WhatsApp en Wuzapi

1. En el dashboard de Wuzapi (o vía API), conecta tu número de WhatsApp:
```bash
curl -X POST https://wuz.jefrien.dev/session/connect \
  -H "token: TU_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"Immediate": false}'
```

2. Escanea el QR code que te devuelve

3. Verifica que esté conectado:
```bash
curl https://wuz.jefrien.dev/session/status \
  -H "token: TU_TOKEN"
```

---

## Paso 8: ¡Probar!

### Enviar mensaje de WhatsApp → Chatwoot

1. Desde otro número de WhatsApp, envía un mensaje al número conectado en Wuzapi
2. Ve a Chatwoot → Inbox `WhatsApp - Wuzapi`
3. Deberías ver:
   - Un nuevo **contacto** creado automáticamente
   - Una nueva **conversación** abierta
   - El mensaje recibido

### Responder desde Chatwoot → WhatsApp

1. En Chatwoot, abre la conversación
2. Escribe una respuesta y envíala
3. El mensaje debería llegar al número de WhatsApp

---

## Solución de Problemas

### "Contacto creado pero no aparece en el inbox"

- Verifica que `CHATWOOT_INBOX_IDENTIFIER` sea correcto
- Verifica que el inbox sea de tipo **API**
- Revisa los logs del conector

### "Mensajes de WhatsApp no llegan a Chatwoot"

- Verifica que el webhook de Wuzapi esté configurado correctamente:
  ```bash
  curl https://wuz.jefrien.dev/webhook -H "token: TU_TOKEN"
  ```
- Verifica que el conector esté accesible desde internet
- Revisa los logs del conector buscando errores

### "Respuestas de Chatwoot no llegan a WhatsApp"

- Verifica que el webhook de Chatwoot tenga la URL correcta
- Asegúrate de que los eventos `message_created` y `message_updated` estén suscritos
- Verifica que `WUZAPI_TOKEN` sea válido

### "Error 401/403 en Chatwoot"

- Verifica que `CHATWOOT_API_TOKEN` sea válido
- Asegúrate de que el token tenga permisos de administrador

### "Error 401 en Wuzapi"

- Verifica que `WUZAPI_TOKEN` sea el token del usuario (no el admin token)

---

## Diagrama del Flujo

```
Usuario WhatsApp
      │
      │ mensaje
      ▼
   WhatsApp Servidores
      │
      │
      ▼
   WuzAPI (conectado vía QR)
      │
      │ webhook POST /webhooks/wuzapi
      ▼
   Conector (este proyecto)
      │
      │ crea contacto + conversación + mensaje
      ▼
   Chatwoot API
      │
      │
      ▼
   Agente ve la conversación en Chatwoot
      │
      │ agente responde
      ▼
   Chatwoot envía webhook POST /webhooks/chatwoot
      │
      │
      ▼
   Conector envía a WuzAPI
      │
      │
      ▼
   Usuario WhatsApp recibe respuesta
```
