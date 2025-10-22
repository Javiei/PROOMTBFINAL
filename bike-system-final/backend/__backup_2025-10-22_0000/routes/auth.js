const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const db = require('../db');

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { username, userId, email, password } = req.body || {};
    // Acepta username o userId o email
    const userField = username || userId || email;
    if (!userField || !password) {
      console.log('[LOGIN] body inválido:', req.body);
      return res.status(400).json({ error: 'Faltan credenciales' });
    }

    console.log('[LOGIN] body recibido:', req.body);

    // Busca por username O email
    const [rows] = await db.execute(
      'SELECT id, username, email, password FROM users WHERE username = ? OR email = ? LIMIT 1',
      [userField, userField]
    );

    if (!rows || rows.length === 0) {
      console.log('[LOGIN] Usuario no encontrado:', userField);
      return res.status(401).json({ error: 'Credenciales incorrectas' });
    }

    const user = rows[0];

    // Valida bcrypt; si no, fallback a texto plano (temporal)
    let ok = false;
    try { ok = await bcrypt.compare(password, user.password); } catch (e) { ok = false; }
    if (!ok && password === user.password) ok = true;

    if (!ok) {
      console.log('[LOGIN] Password mismatch para:', userField);
      return res.status(401).json({ error: 'Credenciales incorrectas' });
    }

    return res.json({
      id: user.id,
      username: user.username,
      email: user.email || null,
      token: 'FAKE_TOKEN_REEMPLAZA'
    });
  } catch (err) {
    console.error('[LOGIN] Error:', err);
    return res.status(500).json({ error: 'Error interno' });
  }
});

module.exports = router;
