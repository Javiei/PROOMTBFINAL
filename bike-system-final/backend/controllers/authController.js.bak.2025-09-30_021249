import db from '../db.js';

export const loginUser = (req, res) => {
  const { userId, password } = req.body;

  db.query(
    'SELECT * FROM users WHERE id = ? AND password = ?',
    [userId, password],
    (err, results) => {
      if (err) {
        console.error('❌ Error SQL Login:', err);  // <-- NUEVO
        return res.status(500).json({ error: 'Error de servidor' });
      }

      if (results.length > 0) {
        const user = results[0];
        res.json({ id: user.id, name: user.name, role: user.role });
      } else {
        res.status(401).json({ error: 'Credenciales incorrectas' });
      }
    }
  );
};
