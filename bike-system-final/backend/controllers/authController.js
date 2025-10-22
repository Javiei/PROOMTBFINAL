import db from '../db.js';

export async function loginUser(req, res) {
  try {
    const { identifier, password } = req.body || {};
    if (!identifier || !password) {
      return res.status(400).json({ error: 'Faltan credenciales' });
    }

    // Tu tabla no tiene email, buscamos por username
    const [rows] = await db.query(
      'SELECT id, username, password, role FROM users WHERE username = ? LIMIT 1',
      [identifier]
    );

    if (!rows.length) return res.status(401).json({ error: 'Usuario no encontrado' });

    const user = rows[0];
    if (user.password !== password) { // (en prod: usa bcrypt)
      return res.status(401).json({ error: 'Credenciales incorrectas' });
    }

    return res.json({ id: user.id, username: user.username, role: user.role });
  } catch (e) {
    console.error('[LOGIN] SQL error:', e);
    return res.status(500).json({ error: 'Error de servidor' });
  }
}
