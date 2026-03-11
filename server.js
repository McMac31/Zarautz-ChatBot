require('dotenv').config();
const express = require('express');
const axios = require('axios');
const { OpenAI } = require('openai');

const app = express();
app.use(express.json());

const groq = new OpenAI({
    apiKey: process.env.GROQ_API_KEY,
    baseURL: "https://api.groq.com/openai/v1"
});

const VERIFY_TOKEN = process.env.VERIFY_TOKEN;

// --- 🧠 SISTEMA DE MEMORIA ---
// Guardamos las charlas de cada número aquí
const memoria = {}; 

const systemInstruction = `Eres el asistente oficial del Club Deportivo Zarautz. 
Responde de forma profesional, amable y MUY BREVE. 

DATOS REALES (No inventes nada fuera de esto):
- Horario Lunes a Viernes: 08:00 a 22:00.
- Sábados: 09:00 a 14:00.
- Domingos y Festivos: CERRADO.
- Pistas de pádel: 15€/hora.

REGLAS CRÍTICAS DE INFORMACIÓN:
1. Si el socio pregunta algo que NO está en estos datos (ej. cuotas, clases, cafetería), di educadamente que no dispones de esa información y que llamen al club al 943 83 14 63.
2. No alucines ni inventes servicios que no están listados aquí.

REGLA DE IDIOMA Y FORMATO:
- Responde SIEMPRE en un solo mensaje con dos bloques: Castellano y Euskera Batua correcto.
- En euskera, el club es "Zarautz Kirol Elkartea". No uses "Zarautz Club".
- No inventes palabras en euskera. Si tienes dudas, usa términos sencillos y correctos.
- Estructura obligatoria: 
  [Texto en Castellano]
  ---
  [Texto en Euskera]`;

app.get('/webhook', (req, res) => {
    if (req.query['hub.verify_token'] === VERIFY_TOKEN) {
        res.status(200).send(req.query['hub.challenge']);
    } else {
        res.sendStatus(403);
    }
});

app.post('/webhook', async (req, res) => {
    const body = req.body;
    if (body.object && body.entry[0].changes[0].value.messages) {
        const message = body.entry[0].changes[0].value.messages[0];
        const from = message.from; 
        const msgText = message.text.body;

        console.log(`📩 Socio (${from}): ${msgText}`);

        // --- LÓGICA DE MEMORIA ACTIVA ---
        // Si es la primera vez del número, le damos las reglas (system)
        if (!memoria[from]) {
            memoria[from] = [{ role: "system", content: systemInstruction }];
        }

        // Añadimos lo que dice el socio al historial de SU número
        memoria[from].push({ role: "user", content: msgText });

        // Limpiamos memoria si es muy larga (máximo 8 mensajes para no perder el hilo)
        if (memoria[from].length > 9) {
            memoria[from].splice(1, 2); // Borra lo más viejo pero mantiene el 'system'
        }

        try {
            // Mandamos TODA la conversación a Groq
            const completion = await groq.chat.completions.create({
                model: "llama-3.3-70b-versatile",
                messages: memoria[from] 
            });

            const aiResponse = completion.choices[0].message.content;

            // Guardamos lo que dijo la IA para que se acuerde en la siguiente pregunta
            memoria[from].push({ role: "assistant", content: aiResponse });

            await axios({
                method: "POST",
                url: `https://graph.facebook.com/v21.0/${process.env.PHONE_NUMBER_ID}/messages`,
                data: {
                    messaging_product: "whatsapp",
                    to: from,
                    text: { body: aiResponse },
                },
                headers: { "Authorization": `Bearer ${process.env.WHATSAPP_TOKEN}` },
            });

            console.log(`🚀 Respondido con contexto: ${aiResponse.substring(0, 30)}...`);

        } catch (error) {
            console.error("❌ Error:", error.message);
        }
    }
    res.sendStatus(200);
});

app.listen(3000, () => console.log('🚀 Bot de Zarautz (70B + Memoria) funcionando'));