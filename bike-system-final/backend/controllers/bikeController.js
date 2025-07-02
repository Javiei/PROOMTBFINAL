import db from '../db.js';

export const getBikes = (req, res) => {
  db.query('SELECT * FROM bikes', (err, results) => {
    if (err) return res.status(500).json({ error: 'Error al obtener bicicletas' });
    res.json(results);
  });
};

export const updateBikeStatus = (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  db.query('UPDATE bikes SET status = ? WHERE id = ?', [status, id], (err) => {
    if (err) return res.status(500).json({ error: 'Error al actualizar estado' });
    res.json({ success: true });
  });
};