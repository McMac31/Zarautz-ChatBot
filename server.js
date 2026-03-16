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

const systemInstruction = `Eres el recepcionista oficial del Club Deportivo Zarautz (Zarautz Kirol Elkartea). 
Tu tono debe ser amable, servicial y proactivo. Trata de ayudar SIEMPRE con la información que tienes disponible.

DATOS REALES DEL CLUB (No inventes nada fuera de esto):
- Horario Lunes a Viernes: 08:00 a 22:00.
- Sábados: 09:00 a 14:00.
- Domingos y Festivos: CERRADO.
- Pistas de squash: 15€/hora.
- 13 Disciplinas deportivas: Fútbol, Balonmano, Baloncesto, Rugby, Halterofilia, Voleibol, Pelota, Herri kirolak, Fútbol sala, Squash, Patinaje, Ajedrez, Atletismo.
REGLA: Si te preguntan por un deporte que NO tenemos (ej. tenis o natación), responde amablemente que no disponéis de esa disciplina, pero MENCIONA la lista de los deportes que SÍ tenéis para ofrecer alternativas.


INFORMACIÓN SOBRE COLONIAS DEPORTIVAS (JOLASTI) Y TORNEOS:
- Colonias Jolasti: Sí se organizan (similar a otros años). Modalidades y turnos/semanas: Areto futbola+saskibaloia (7), Errugbia (4), Eskubaloia (5), Futbola (5), Futbol teknifikazioa (5), Saskibaloia (7), Saski teknifikazioa (4), Halterofilia teknifikazioa (4), Irristaketa (2). 
- Estado Colonias: Aún NO hay fechas de inicio ni está abierta la inscripción. (Recomendar ver info de la edición 2025).
- Torneos/Ediciones de Verano: 
  * Edición Niñ@s (LH3 - DBH2): 4 y 5 de Julio.
  * Edición Adult@s (DBH3 en adelante): 11 y 12 de Julio.
  * Estado: Inscripciones cerradas todavía. (Recomendar ver info edición 2025).
  * REGLA: Si preguntan por las colonias de un deporte específico (ej. fútbol), diles exactamente cuántos turnos hay disponibles para ese deporte antes de aclarar que la inscripción no está abierta aún.
  * REGLA: Si preguntan por los torneos, DEBES DARLES LAS FECHAS EXACTAS del evento primero, y después indicarles que la inscripción aún está cerrada.
  
REGLAS ESTRICTAS DE INFORMACIÓN:
1. Si el socio pregunta algo que NO está en estos datos, di educadamente que no dispones de esa información y que llamen al 943 83 14 63.
2. NUNCA inventes fechas de inscripción si aquí dice que están cerradas.

ENFOQUE ESTRICTO: Responde ÚNICAMENTE a la última pregunta o mensaje del usuario. Está TERMINANTEMENTE PROHIBIDO repetir información sobre temas anteriores que el usuario ya no está preguntando (por ejemplo, no vuelvas a hablar de tenis si ahora te preguntan por colonias).

REGLA DE IDIOMA Y FORMATO:
- Responde SIEMPRE en un solo mensaje con dos bloques: Castellano y Euskera Batua correcto.
- En euskera, el club es "Zarautz Kirol Elkartea". No uses "Zarautz Club".
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
            const intencionObj = await detectarIntencion(groq, memoria[from]);
            console.log(`🧠 Intención detectada:`, intencionObj);

            let aiResponse = "";

            switch (intencionObj.intencion) {
                case "agendar_cita":
                // VALIDACIÓN DE HORARIO
                if (intencionObj.horario_valido === false) {
                       const partes = (intencionObj.motivo_invalido || "").split("---");
                        const motivoEs = partes[0]?.trim() || "Horario no disponible.";
                        const motivoEu = partes[1]?.trim() || motivoEs;
                        aiResponse = `Lo siento, esa hora no es posible. ${motivoEs}\n---\nBarkatu, ordu hori ez da posible. ${motivoEu}`;
                        break;
                    }
                    //  DEMO DE AGENDAMIENTO DE CITA---
                    if (intencionObj.fecha && intencionObj.hora) {
                        // Escenario 1: Tenemos ambos datos (El Efecto Guau)
                        aiResponse = `¡Reserva confirmada!\nSe ha guardado tu pista para el **${intencionObj.fecha}** a las **${intencionObj.hora}**.\n(En la versión final, esto se conectará automáticamente al calendario del club).\n---\n Erreserba baieztatuta!\nPista gordeta **${intencionObj.fecha}**-rako, **${intencionObj.hora}**-tan.`;
                    
                    } else if (intencionObj.fecha && !intencionObj.hora) {
                        // Escenario 2: Nos ha dicho el día, pero NO la hora
                        aiResponse = `¡Genial! Tienes pensado jugar el **${intencionObj.fecha}**. ¿A qué **hora** te gustaría reservar?\n---\nBikain! **${intencionObj.fecha}**-(e)an jokatzeko asmoa duzu. Zer **ordu**-tan erreserbatu nahi duzu?`;
                    
                    } else if (!intencionObj.fecha && intencionObj.hora) {
                        // Escenario 3: Nos ha dicho la hora, pero NO el día
                        aiResponse = `Perfecto, a las **${intencionObj.hora}**. ¿Para qué **día** de la semana quieres la pista?\n---\nPrimeran, **${intencionObj.hora}**-(e)tan. Asteko zein **egun**-tarako nahi duzu pista?`;
                    
                    } else {
                        // Escenario 4: Solo ha dicho "quiero jugar" sin día ni hora
                        aiResponse = "¡Perfecto! Vamos a reservar tu pista 🎾. Para poder agendarlo, ¿qué **día** y **hora** te viene bien?\n---\nEzin hobeto! Zure pista erreserbatuko dugu 🎾. Erreserba egiteko, zer **egun** eta **ordu** datorkizu ondo?";
                    }
                    break;
                    
               

                case "cancelar_cita":
                    aiResponse = "Para cancelar tu reserva, por favor llama al 943 83 14 63.\n---\nZure erreserba bertan behera uzteko, deitu 943 83 14 63 zenbakira.";
                    break;

                case "consulta_info":
                case "saludo":
                default:
                    // 1. Buscamos el nombre en el historial
                    const historial = memoria[from] || [];
                    const mensajesUsuario = historial
                        .filter(m => m.role === "user")
                        .map(m => m.content)
                        .join(" ");
                    
                    const nombreMatch = mensajesUsuario.match(/me llamo (\w+)|soy (\w+)/i);
                    const nombre = nombreMatch ? (nombreMatch[1] || nombreMatch[2]) : null;

                    // 2. Inyectamos el nombre en el system prompt si lo tenemos
                    const systemConNombre = nombre
                        ? `${systemInstruction}\n\nDATO IMPORTANTE: El usuario se llama ${nombre}. Úsalo para personalizar tu respuesta.`
                        : systemInstruction;

                    // 3. Solo mandamos system + mensaje actual, sin historial contaminado
                    const completion = await groq.chat.completions.create({
                        model: "llama-3.3-70b-versatile",
                        messages: [
                            { role: "system", content: systemConNombre },
                            { role: "user", content: msgText }
                        ]
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