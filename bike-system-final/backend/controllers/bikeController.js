import db from '../db.js';

export const getBikes = async (req, res) => {
  try {
    const [rows] = await db.promise().query(
      `SELECT id, clientName, clientLastName, phoneNumber, email, address,
              bikeModel, bikeBrand, description, problem, assignedTo,
              status, entryDate, comentario, numeroFactura
         FROM bikes
        ORDER BY entryDate DESC, id DESC`
    );
    res.json(rows || []);
  } catch (e) {
    console.error('[getBikes] Error:', e);
    res.status(500).json({ error: 'Error de servidor' });
  }
};
