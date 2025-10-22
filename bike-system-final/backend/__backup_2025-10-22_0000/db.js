// db.js (mysql2/promise)
import { createPool } from 'mysql2/promise';

const pool = createPool({
  host: process.env.DB_HOST || '127.0.0.1',
  user: process.env.DB_USER || 'bikeuser',
  password: process.env.DB_PASS || '12345',
  database: process.env.DB_NAME || 'bikedb',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  // opcional: evita timeouts
  connectTimeout: 20000,
});

export default pool;

