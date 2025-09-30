// backend/controllers/authController.js
import db from '../db.js';
import bcrypt from 'bcryptjs';

export async function loginUser(req, res) {
  try {
    const { identifier, password } = req.body || {};
    if (!identifier || !password) {
      return res.status(400).json({ error: 'Faltan datos' });
    }

    // Busca solo por username
    const [rows] = await db.execute(
      'SELECT id, username, password, role FROM users WHERE username = ? LIMIT 1',
      [identifier]
    );
    if (!rows.length) return res.status(401).json({ error: 'Credenciales incorrectas' });

    const user = rows[0];
    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return res.status(401).json({ error: 'Credenciales incorrectas' });

    return res.json({ id: user.id, username: user.username, role: user.role });
  } catch (e) {
    console.error('[LOGIN] Error:', e);
    return res.status(500).json({ error: 'Error en login' });
  }
}
