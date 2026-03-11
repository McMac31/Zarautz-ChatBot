# 🎾 Zarautz-ChatBot: Asistente Virtual Inteligente

Asistente oficial para el **Club Deportivo Zarautz** (Zarautz Kirol Elkartea). Este bot gestiona consultas de socios a través de WhatsApp, ofreciendo respuestas bilingües y manteniendo el contexto de la conversación.

---

## ✨ Características Principales
* **Inteligencia Artificial:** Implementación de **Llama 3.3 70B** vía Groq para una lógica avanzada.
* **Bilingüismo Nativo:** Respuestas automáticas en **Castellano** y **Euskera Batua**.
* **Memoria de Contexto:** Capacidad para recordar nombres y temas tratados previamente en el chat.
* **Información Real:** Gestión de horarios de apertura (L-V, Sábados) y tarifas de pistas.

---

## 🛠️ Stack Tecnológico
* **Runtime:** Node.js
* **Framework:** Express.js
* **IA:** Groq Cloud API (Llama 3.3 70B)
* **Comunicación:** WhatsApp Cloud API (Meta)
* **Cliente HTTP:** Axios (Async/Await)

---

## 🚀 Instalación y Configuración

Sigue estos pasos para poner en marcha el bot en tu entorno local:

### 1. Clonar el repositorio
```bash
git clone [https://github.com/McMac31/Zarautz-ChatBot.git](https://github.com/McMac31/Zarautz-ChatBot.git)
cd Zarautz-ChatBot

```

### 2. Instalar dependencias

```bash
npm install

```

### 3. Configurar variables de entorno

Crea un archivo `.env` en la raíz del proyecto y añade tus credenciales:

```env
GROQ_API_KEY=tu_key_de_groq
WHATSAPP_TOKEN=tu_token_de_meta
PHONE_NUMBER_ID=tu_id_de_telefono
VERIFY_TOKEN=tu_token_de_verificacion

```

### 4. Lanzar el servidor

```bash
node server.js

```

---

## 🔧 Túnel Local (Webhooks)

Para que Meta pueda enviar mensajes a tu servidor local, recuerda usar **ngrok**:

```bash
ngrok http 3000

```

Copia la URL `https` generada y pégala en el panel de configuración de Webhooks de Meta Developers añadiendo `/webhook` al final.

---

## 📝 Notas del Proyecto

Este bot está diseñado específicamente para mejorar la atención al socio del club, evitando respuestas genéricas y asegurando una comunicación bilingüe fluida.

Desarrollado por **[McMac31](https://www.google.com/search?q=https://github.com/McMac31)**.

```
```
