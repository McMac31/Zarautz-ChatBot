const detectarIntencion = async (groq, mensaje) => {
    try {
        const completion = await groq.chat.completions.create({
            model: "llama-3.3-70b-versatile",
            response_format: { type: "json_object" }, // Forzamos el JSON nativo.
            messages: [ // Instrucción clara para clasificación de intenciones
                {
                    role: "system",
                    content: `Eres un clasificador de intenciones para un club deportivo.
Analiza el mensaje del usuario y devuelve ÚNICAMENTE un JSON válido con esta estructura exacta:
{
  "intencion": "agendar_cita" | "cancelar_cita" | "consulta_info" | "saludo" | "otro",
  "servicio": "pádel" | null,
  "fecha": "texto exacto que dijo" | null,
  "hora": "texto exacto que dijo" | null
}`
                },
                { role: "user", content: mensaje }
            ],
        });

        const raw = completion.choices[0].message.content;
        return JSON.parse(raw);
    } catch (e) {
        console.error("❌ Error al clasificar intención:", e.message);
        return { intencion: "otro", servicio: null, fecha: null, hora: null };
    }
};

module.exports = { detectarIntencion }; // Exportamos la función para usarla en server.js