import bcrypt from 'bcryptjs';
import db from '../db.js';

const comparePasswordFlexible = async (plain, stored) => {
  try {
    if (typeof stored === 'string' && stored.startsWith('$2')) {
      return await bcrypt.compare(plain, stored);
    }
  } catch (_) {}
  return plain === stored;
};

export const loginUser = async (req, res) => {
  try {
    const { username, userId, password } = req.body || {};
    const identifier = (username || userId || '').trim();
    const pass = (password || '').trim();

    console.log('[LOGIN] body:', { identifier, passLen: pass.length });
    if (!identifier || !pass) return res.status(400).json({ error: 'Faltan credenciales' });

    let rows;

    // 1) por username
    try {
      [rows] = await db.query(
        'SELECT id, username, password, role FROM users WHERE username = ? LIMIT 1',
        [identifier]
      );
    } catch (e) {
      console.error('[LOGIN] SQL err (username):', e);
      return res.status(500).json({ error: 'Error de base de datos' });
    }

    // 2) fallback por userId (si existe esa columna)
    if (!rows || rows.length === 0) {
      try {
        [rows] = await db.query(
          'SELECT id, username, password, role FROM users WHERE userId = ? LIMIT 1',
          [identifier]
        );
      } catch (e2) {
        console.warn('[LOGIN] userId fallback no disponible:', e2.code || e2);
      }
    }

    if (!rows || rows.length === 0) {
      return res.status(401).json({ error: 'Credenciales incorrectas' });
    }

    const user = rows[0];
    const ok = await comparePasswordFlexible(pass, user.password);
    if (!ok) return res.status(401).json({ error: 'Credenciales incorrectas' });

    res.json({ id: user.id, username: user.username, role: user.role || null, token: 'FAKE_TOKEN_REEMPLAZA' });
  } catch (err) {
    console.error('[LOGIN] Error inesperado:', err);
    res.status(500).json({ error: 'Error interno' });
  }
};
