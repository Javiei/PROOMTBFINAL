import db from '../db.js';

// Obtener todas las bicicletas
export const getBikes = (req, res) => {
  db.query('SELECT * FROM bikes', (err, results) => {
    if (err) return res.status(500).json({ error: 'Error al obtener bicicletas' });
    res.json(results);
  });
};

// Agregar una bicicleta nueva
export const addBike = (req, res) => {
  const bike = req.body;
  db.query('INSERT INTO bikes SET ?', bike, (err, result) => {
    if (err) return res.status(500).json({ error: 'Error al agregar bicicleta' });
    res.json({ ...bike, id: result.insertId });
  });
};

export const updateBike = (req, res) => {
  const { id } = req.params;
  const bike = req.body;
  db.query('UPDATE bikes SET ? WHERE id = ?', [bike, id], (err) => {
    if (err) return res.status(500).json({ error: 'Error al actualizar bicicleta' });
    res.json({ ...bike, id });
  });
};


// Actualizar solo el estado
export const updateBikeStatus = (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  if (!id || !status) {
    return res.status(400).json({ error: 'Faltan campos requeridos' });
  }

  db.query('UPDATE bikes SET status = ? WHERE id = ?', [status, id], (err) => {
    if (err) return res.status(500).json({ error: 'Error al actualizar estado' });
    res.json({ success: true });
  });
};

// Eliminar bicicleta
export const deleteBike = (req, res) => {
  const { id } = req.params;
  db.query('DELETE FROM bikes WHERE id = ?', [id], (err) => {
    if (err) return res.status(500).json({ error: 'Error al eliminar bicicleta' });
    res.json({ success: true });
  });
};
