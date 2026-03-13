require('dotenv').config(); // Carga las variables de entorno desde el archivo .env
const express = require('express'); // Framework web para Node.js
const axios = require('axios'); // Para enviar mensajes a la API de WhatsApp
const { OpenAI } = require('openai'); // SDK oficial de OpenAI para Node.js
const { detectarIntencion } = require('./services/intenciones'); // Importamos la función de detección de intenciones

const app = express(); // Creamos una aplicación Express
app.use(express.json()); //Para parsear JSON en las solicitudes entrantes

const groq = new OpenAI({
    apiKey: process.env.GROQ_API_KEY,
    baseURL: "https://api.groq.com/openai/v1"
}); // Creamos una instancia de OpenAI apuntando a Groq

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

        // --- VALIDACIÓN DE QUE SEA UN MENSAJE DE TEXTO ---
        if (message.type !== "text") {
            console.log(`⚠️ Mensaje no soportado (${message.type}) de ${from}`);
            try {
                await axios({
                    method: "POST",
                    url: `https://graph.facebook.com/v21.0/${process.env.PHONE_NUMBER_ID}/messages`,
                    data: {
                        messaging_product: "whatsapp",
                        to: from,
                        text: { body: "Lo siento, solo puedo leer mensajes de texto. 📝\n---\nBarkatu, testu mezuak bakarrik irakur ditzaket. 📝" },
                    },
                    headers: { "Authorization": `Bearer ${process.env.WHATSAPP_TOKEN}` },
                });
            } catch (error) {
                console.error("❌ Error al enviar mensaje de validación:", error.message);
            }
            return res.sendStatus(200); //  Siempre responde 200 a Meta aunque el mensaje no sea de texto, para evitar que se caiga todo.
        }

        const msgText = message.text.body;
        console.log(`📩 Socio (${from}): ${msgText}`);

        // --- 🧠 MEMORIA ---
        if (!memoria[from]) {
            memoria[from] = [{ role: "system", content: systemInstruction }];
        }
        memoria[from].push({ role: "user", content: msgText });
        if (memoria[from].length > 9) {
            memoria[from].splice(1, 2);
        }

        // --- 🎯 ENRUTADOR ---
        try {
            const intencionObj = await detectarIntencion(groq, msgText);
            console.log(`🧠 Intención detectada:`, intencionObj);

            let aiResponse = "";

            switch (intencionObj.intencion) {
                case "agendar_cita":
                    //  DEMO DE AGENDAMIENTO DE CITA---
                    if (intencionObj.fecha && intencionObj.hora) {
                        aiResponse = `¡Reserva confirmada!\nSe ha guardado tu pista para el **${intencionObj.fecha}** a las **${intencionObj.hora}**.\n(En la versión final, esto se conectará automáticamente al google calendar).\n---\n Erreserba baieztatuta!\nPista gordeta **${intencionObj.fecha}**-rako, **${intencionObj.hora}**-tan.`;
                    } else {
                        aiResponse = "¡Perfecto! Vamos a reservar tu pista 🎾. Para poder agendarlo, ¿qué **día** y **hora** te viene bien?\n---\nEzin hobeto! Zure pista erreserbatuko dugu 🎾. Erreserba egiteko, zer **egun** eta **ordu** datorkizu ondo?";
                    }
                    break;
               

                case "cancelar_cita":
                    aiResponse = "Para cancelar tu reserva, por favor llama al 943 83 14 63.\n---\nZure erreserba bertan behera uzteko, deitu 943 83 14 63 zenbakira.";
                    break;

                case "consulta_info":
                case "saludo":
                default:
                    const completion = await groq.chat.completions.create({
                        model: "llama-3.3-70b-versatile",
                        messages: memoria[from]
                    });
                    aiResponse = completion.choices[0].message.content;
                    break;
            }

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

            console.log(`🚀 Respuesta enviada.`);

        } catch (error) {
            console.error("❌ Error en el flujo principal:", error.message);
            if (error.response) {
                    console.error("📋 Detalle del error:", JSON.stringify(error.response.data, null, 2));
            }
            
        }
    }

    res.sendStatus(200); // Meta siempre recibe 200 para evitar errores de webhook, incluso si algo falla internamente.
});

const PORT = process.env.PORT || 3000; // Puerto de escucha del servidor
app.listen(PORT, () => console.log(`🚀 Bot de Zarautz funcionando en puerto ${PORT}`));