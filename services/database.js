const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

const initDB = async () => {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS usuarios (
                telefono VARCHAR(20) PRIMARY KEY,
                nombre VARCHAR(50),
                ultima_interaccion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS historial (
                id SERIAL PRIMARY KEY,
                telefono VARCHAR(20) REFERENCES usuarios(telefono) ON DELETE CASCADE,
                role VARCHAR(10) NOT NULL,
                content TEXT NOT NULL,
                fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS citas (
                id SERIAL PRIMARY KEY,
                telefono VARCHAR(20) REFERENCES usuarios(telefono) ON DELETE CASCADE,
                fecha DATE NOT NULL,
                hora TIME NOT NULL,
                servicio VARCHAR(50) DEFAULT 'squash',
                estado VARCHAR(20) DEFAULT 'confirmada',
                google_event_id VARCHAR(100),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log("🐘 Base de datos conectada y tablas PRO verificadas.");
    } catch (error) {
        console.error("❌ Error al inicializar la base de datos:", error.message);
    }
};
initDB(); // Inicializamos la base de datos al arrancar el servidor 

// Crea el usuario si no existe y actualiza su última interacción
const upsertUsuario = async (telefono, nombre = null) => {
    await pool.query(`
        INSERT INTO usuarios (telefono, nombre, ultima_interaccion)
        VALUES ($1, $2, NOW())
        ON CONFLICT (telefono) DO UPDATE 
        SET ultima_interaccion = NOW(),
            nombre = COALESCE($2, usuarios.nombre)
    `, [telefono, nombre]);
};

// Guarda un mensaje en el historial
const guardarMensaje = async (telefono, role, content) => {
    await pool.query(`
        INSERT INTO historial (telefono, role, content)
        VALUES ($1, $2, $3)
    `, [telefono, role, content]);
};

// Recupera los últimos N mensajes de un usuario
const obtenerHistorial = async (telefono, limite = 8) => {
    const result = await pool.query(`
        SELECT role, content FROM historial
        WHERE telefono = $1
        ORDER BY fecha DESC
        LIMIT $2
    `, [telefono, limite]);

    // Invertimos para que estén en orden cronológico
    return result.rows.reverse();
};

// Obtiene el nombre del usuario si lo tenemos guardado
const obtenerNombre = async (telefono) => {
    const result = await pool.query(`
        SELECT nombre FROM usuarios WHERE telefono = $1
    `, [telefono]);
    return result.rows[0]?.nombre || null;
};

module.exports = { upsertUsuario, guardarMensaje, obtenerHistorial, obtenerNombre };