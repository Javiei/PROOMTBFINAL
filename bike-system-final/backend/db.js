// backend/db.js
import 'dotenv/config';
import mysql from 'mysql2/promise';

// Config base: fuerza IPv4 (127.0.0.1) y evita 'localhost'
const cfg = {
  host: (process.env.DB_HOST || '127.0.0.1'),
  port: Number(process.env.DB_PORT || 3306),
  user: (process.env.DB_USER || 'proom'),            // usa tu usuario
  password: (process.env.DB_PASS || 'Proom#2024!'),  // y tu pass
  database: (process.env.DB_NAME || 'proomtb'),
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
};

// Por si alguien dejó 'localhost' en el .env, lo convierto a 127.0.0.1
if (cfg.host === 'localhost') cfg.host = '127.0.0.1';

console.log('[DB CFG]', { host: cfg.host, port: cfg.port, user: cfg.user });

const pool = mysql.createPool(cfg);

// Sanity check para ver el error real en logs si no conecta
try {
  await pool.query('SELECT 1');
} catch (e) {
  console.error('[DB] No conecta:', e.code, e.message);
}

export default pool;
