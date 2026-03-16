
const detectarIntencion = async (groq, historial) => { 
    try {
        const completion = await groq.chat.completions.create({
            model: "llama-3.3-70b-versatile",
            response_format: { type: "json_object" }, // Obligamos a Groq a responder en JSON
            messages: [
                {
                    role: "system",
                    content: `Eres un experto clasificador para el Club Deportivo Zarautz.
Tu objetivo es extraer datos de reserva y VALIDAR si cumplen las normas del club.

NORMAS DEL CLUB:
- Lunes a Viernes: 08:00 a 22:00.
- Sábados: 09:00 a 14:00.
- Domingos y Festivos: CERRADO.

ESTRUCTURA JSON OBLIGATORIA (Debe ser UN SOLO OBJETO, NUNCA un array):
{
  "intencion": "agendar_cita" | "cancelar_cita" | "consulta_info" | "saludo" | "otro",
  "servicio": "pádel" | null,
  "fecha": "texto" | null,
  "hora": "texto" | null,
  "horario_valido": true | false,
  "motivo_invalido": "Motivo en castellano. --- Arrazoia euskaraz." | null
}
  
DEFINICIONES ESTRICTAS DE INTENCIÓN:
- "agendar_cita": SOLO cuando el usuario quiere RESERVAR una PISTA explícitamente. 
  ✅ "quiero reservar una pista", "necesito una pista el jueves", "reservar squash" 
  ❌ "quiero practicar halterofilia", "me interesa el fútbol", "quiero apuntarme"
- "cancelar_cita": quiere cancelar una reserva ya existente.
- "consulta_info": cualquier pregunta sobre horarios, precios, deportes, colonias, torneos, instalaciones, o interés general en practicar algún deporte. 
  ✅ "quiero practicar halterofilia", "tienen tenis", "cuánto cuesta", "colonias"
- "saludo": solo saludos o despedidas sin intención concreta.
- "otro": cualquier cosa que no encaje en las anteriores.

REGLAS DE VALIDACIÓN:
1. NUNCA devuelvas un array.
2. Si el usuario pide un DOMINGO o una hora fuera de rango, marca "horario_valido": false.
3. Si faltan datos de fecha u hora en agendar_cita, "horario_valido" debe ser true.
4. CONTEXTO: Si el usuario da un dato nuevo (ej. la hora) que responde a una pregunta previa del bot para una reserva de pádel, el JSON debe incluir también los datos mencionados anteriormente (ej. la fecha).
5. NO INVENTAR: Si un dato no se ha mencionado en ningún momento de la charla, pon null.
6. INSULTOS: Ignóralos completamente y extrae la intención real.`
                },
                // Aquí volcamos todo el historial para que la IA sepa de qué viene la charla
                ...historial 
            ],
        });

        const raw = completion.choices[0].message.content;
        return JSON.parse(raw);

    } catch (e) {
        console.error("❌ Error en el servicio de intenciones:", e.message);
        // Fallback para que el bot no se detenga si la IA falla
        return { intencion: "otro", servicio: null, fecha: null, hora: null };
    }
};

module.exports = { detectarIntencion };