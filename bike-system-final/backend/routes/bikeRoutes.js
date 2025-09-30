import express from 'express';
import db from '../db.js';

const router = express.Router();

const toDate = (v) => {
  if (!v) return null;
  const s = String(v).slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
};

// --- HEALTH DB ---
router.get('/health/db', async (_req, res) => {
  try {
    const [[row]] = await db.query('SELECT 1 AS ok');
    return res.json({ ok: row?.ok === 1 });
  } catch (e) {
    console.error('[HEALTH DB] Error:', { code: e?.code, msg: e?.sqlMessage });
    return res.status(500).json({ error: 'DB error', code: e?.code, msg: e?.sqlMessage });
  }
});

// GET /api/bikes/tienda (tolerante a status|estado, entryDate|created_at)
router.get('/tienda', async (_req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT
         id, clientName, clientLastName, phoneNumber, email, address,
         bikeModel, bikeBrand, description, problem, assignedTo,
         COALESCE(status, estado) AS status,
         COALESCE(entryDate, created_at) AS entryDate,
         comentario, numeroFactura
       FROM bikes
       WHERE COALESCE(status, estado) IN ('listo_tienda','tienda','terminado')
       ORDER BY COALESCE(entryDate, created_at) DESC, id DESC`
    );
    res.json(rows || []);
  } catch (e) {
    console.error('[TIENDA LIST] Error:', { code: e?.code, msg: e?.sqlMessage, stack: e?.stack });
    res.status(500).json({ error: 'Error de servidor', code: e?.code, msg: e?.sqlMessage });
  }
});

// GET /api/bikes/tienda/stats (tolerante a status|estado)
router.get('/tienda/stats', async (_req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT COALESCE(status, estado) AS status, COUNT(*) AS count
         FROM bikes
        WHERE COALESCE(status, estado) IN ('listo_tienda','tienda','terminado')
        GROUP BY COALESCE(status, estado)
        ORDER BY count DESC`
    );
    res.json(rows || []);
  } catch (e) {
    console.error('[TIENDA STATS] Error:', { code: e?.code, msg: e?.sqlMessage, stack: e?.stack });
    res.status(500).json({ error: 'Error de servidor', code: e?.code, msg: e?.sqlMessage });
  }
});

// GET /api/bikes/:id
router.get('/:id', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM bikes WHERE id = ? LIMIT 1', [req.params.id]);
    if (!rows?.length) return res.status(404).json({ error: 'No encontrado' });
    res.json(rows[0]);
  } catch (e) {
    console.error('[BIKE GET] Error:', { code: e?.code, msg: e?.sqlMessage, stack: e?.stack });
    res.status(500).json({ error: 'Error de servidor', code: e?.code, msg: e?.sqlMessage });
  }
});

// PUT /api/bikes/:id  (mantén el tuyo si ya lo tienes; este deja logs mejores)
router.put('/:id', async (req, res) => {
  const id = req.params.id;
  const {
    clientName, clientLastName, phoneNumber, email, address,
    bikeModel, bikeBrand, description, problem, assignedTo,
    status, entryDate, clientId, comentario, numeroFactura
  } = req.body || {};

  const dateStr = toDate(entryDate);

  const fields = {
    clientName, clientLastName, phoneNumber, email, address,
    bikeModel, bikeBrand, description, problem, assignedTo,
    status, clientId, comentario, numeroFactura
  };

  // Construye SET dinámico
  const setParts = [];
  const values = [];
  for (const [k, v] of Object.entries(fields)) {
    if (typeof v !== 'undefined') {
      setParts.push('`' + k + '` = ?');
      values.push(v === '' ? null : v);
    }
  }
  if (dateStr !== null) {
    setParts.push('`entryDate` = ?');
    values.push(dateStr);
  }

  if (!setParts.length) return res.json({ ok: true });

  try {
    values.push(id);
    await db.query(`UPDATE bikes SET ${setParts.join(', ')} WHERE id = ?`, values);
    return res.json({ ok: true });
  } catch (e) {
    console.error('[BIKE UPDATE] Error:', { code: e?.code, msg: e?.sqlMessage, stack: e?.stack });
    // Respuesta con detalle para que el frontend lo vea durante la migración
    return res.status(500).json({ error: 'Error de servidor', code: e?.code, msg: e?.sqlMessage });
  }
});

export default router;
