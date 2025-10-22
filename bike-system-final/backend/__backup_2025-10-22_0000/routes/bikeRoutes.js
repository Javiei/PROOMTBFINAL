// backend/routes/bikeRoutes.js
import express from 'express';
import db from '../db.js';

const router = express.Router();

/* =========================
   CONFIG: Estados válidos
   ========================= */
export const VALID_STATUSES = new Set([
  'chofer',
  'lavado',
  'por cotizar',
  'en cotizacion',
  'en reparacion',
  'listo_chofer',
  'listo_tienda',
  'tienda',
  'terminado',
]);

// Si en la DB quedaron valores legacy, mapeamos aquí:
const LEGACY_MAP = new Map([
  ['ingresada', 'chofer'],
  ['en_revision', 'por cotizar'],
  ['en_reparacion', 'en reparacion'],
  ['entregado', 'terminado'],
  ['en_cotizacion', 'en cotizacion'],
  ['delivery', 'tienda'], // o 'terminado' si prefieres
  ['ruta', 'tienda'],     // o 'terminado' si prefieres
]);

const normalizeStatus = (raw) => {
  if (!raw) return null;
  const s = String(raw).trim();
  if (VALID_STATUSES.has(s)) return s;
  if (LEGACY_MAP.has(s)) return LEGACY_MAP.get(s);
  return null;
};

const toDate = (v) => {
  if (!v) return null;
  const s = String(v).slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
};

// Helper para respuestas de error uniformes
const sendServerError = (res, tag, e) => {
  console.error(tag, { code: e?.code, msg: e?.sqlMessage, stack: e?.stack });
  res.status(500).json({ error: 'Error de servidor', code: e?.code, msg: e?.sqlMessage });
};

/* =========================
   HEALTH
   ========================= */
router.get('/health/db', async (_req, res) => {
  try {
    const [[row]] = await db.query('SELECT 1 AS ok');
    return res.json({ ok: row?.ok === 1 });
  } catch (e) {
    console.error('[HEALTH DB] Error:', { code: e?.code, msg: e?.sqlMessage });
    return res.status(500).json({ error: 'DB error', code: e?.code, msg: e?.sqlMessage });
  }
});

/* =========================
   LISTAS TIENDA
   ========================= */

// GET /api/bikes/tienda  (tolerante a columnas status|estado y entryDate|created_at)
router.get('/tienda', async (_req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT
         id, clientName, clientLastName, phoneNumber, email, address,
         bikeModel, bikeBrand, description, problem, assignedTo,
         COALESCE(status, estado) AS status,
         COALESCE(entryDate, created_at) AS entryDate,
         comentario, numeroFactura, updatedAt
       FROM bikes
       WHERE COALESCE(status, estado) IN ('listo_tienda','tienda','terminado')
       ORDER BY updatedAt DESC, id DESC`
    );

    // normalizar por si arrastran legacy
    const out = rows?.map(r => ({
      ...r,
      status: normalizeStatus(r.status) || r.status,
      entryDate: toDate(r.entryDate),
    })) || [];

    res.json(out);
  } catch (e) {
    sendServerError(res, '[TIENDA LIST] Error:', e);
  }
});

// GET /api/bikes/tienda/stats
router.get('/tienda/stats', async (_req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT COALESCE(status, estado) AS status, COUNT(*) AS count
         FROM bikes
        WHERE COALESCE(status, estado) IN ('listo_tienda','tienda','terminado')
        GROUP BY COALESCE(status, estado)
        ORDER BY count DESC`
    );

    // normalizar claves
    const out = rows?.map(r => ({
      status: normalizeStatus(r.status) || r.status,
      count: r.count,
    })) || [];

    res.json(out);
  } catch (e) {
    sendServerError(res, '[TIENDA STATS] Error:', e);
  }
});

/* =========================
   CRUD BÁSICO DE BIKES
   ========================= */

// GET /api/bikes  (lista completa)
router.get('/', async (_req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT id, clientName, clientLastName, phoneNumber, email, address,
              bikeModel, bikeBrand, description, problem, assignedTo,
              COALESCE(status, estado) AS status,
              COALESCE(entryDate, created_at) AS entryDate,
              comentario, numeroFactura, createdAt, updatedAt
         FROM bikes
        ORDER BY updatedAt DESC, id DESC`
    );
    const out = rows?.map(r => ({
      ...r,
      status: normalizeStatus(r.status) || r.status,
      entryDate: toDate(r.entryDate),
    })) || [];

    res.json(out);
  } catch (e) {
    sendServerError(res, '[BIKES LIST] Error:', e);
  }
});

// POST /api/bikes  (crear registro)
router.post('/', async (req, res) => {
  try {
    const {
      clientName, clientLastName, phoneNumber, email, address,
      bikeModel, bikeBrand, description,
      problem, assignedTo, status, entryDate,
      clientId, comentario, numeroFactura
    } = req.body || {};

    const sNorm = normalizeStatus(status) || 'chofer';
    const dateStr = toDate(entryDate) || toDate(new Date());

    if (!clientName || !phoneNumber) {
      return res.status(400).json({ error: 'clientName y phoneNumber son obligatorios' });
    }
    if (!VALID_STATUSES.has(sNorm)) {
      return res.status(400).json({ error: 'status inválido' });
    }

    const [result] = await db.query(
      `INSERT INTO bikes
       (clientName, clientLastName, phoneNumber, email, address,
        bikeModel, bikeBrand, description, problem, assignedTo,
        status, entryDate, clientId, comentario, numeroFactura)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        clientName || null, clientLastName || null, phoneNumber || null, email || null, address || null,
        bikeModel || null, bikeBrand || null, description || null, problem || null, assignedTo || null,
        sNorm, dateStr, clientId || null, comentario || null, numeroFactura || null
      ]
    );

    const id = result?.insertId;
    const [[row]] = await db.query('SELECT * FROM bikes WHERE id = ? LIMIT 1', [id]);
    return res.status(201).json(row);
  } catch (e) {
    sendServerError(res, '[BIKE CREATE] Error:', e);
  }
});

// GET /api/bikes/:id
router.get('/:id', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM bikes WHERE id = ? LIMIT 1', [req.params.id]);
    if (!rows?.length) return res.status(404).json({ error: 'No encontrado' });
    const r = rows[0];
    r.status = normalizeStatus(r.status) || r.status;
    r.entryDate = toDate(r.entryDate);
    res.json(r);
  } catch (e) {
    sendServerError(res, '[BIKE GET] Error:', e);
  }
});

// PUT /api/bikes/:id
router.put('/:id', async (req, res) => {
  const id = req.params.id;
  const {
    clientName, clientLastName, phoneNumber, email, address,
    bikeModel, bikeBrand, description, problem, assignedTo,
    status, entryDate, clientId, comentario, numeroFactura
  } = req.body || {};

  const sNorm = typeof status === 'undefined' ? undefined : normalizeStatus(status);
  if (typeof status !== 'undefined' && !sNorm) {
    return res.status(400).json({ error: 'status inválido' });
  }

  const dateStr = toDate(entryDate);

  const fields = {
    clientName, clientLastName, phoneNumber, email, address,
    bikeModel, bikeBrand, description, problem, assignedTo,
    status: sNorm, clientId, comentario, numeroFactura
  };

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
    sendServerError(res, '[BIKE UPDATE] Error:', e);
  }
});

// DELETE /api/bikes/:id
router.delete('/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      return res.status(400).json({ error: 'ID inválido' });
    }

    // Si tu columna se llama "id_bike" o "bike_id", agrégala aquí
    const [result] = await db.query(
      'DELETE FROM bikes WHERE id = ? OR id_bike = ? OR bike_id = ?',
      [id, id, id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'No encontrado' });
    }

    return res.json({ ok: true, deletedId: id });
  } catch (e) {
    sendServerError(res, '[BIKE DELETE] Error:', e);
  }
});

/* =========================
   BUCKETS POR ROL (opcionales)
   ========================= */

// Chofer: pendientes de llevar
router.get('/bucket/chofer', async (_req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT * FROM bikes WHERE COALESCE(status, estado) = 'chofer' ORDER BY updatedAt DESC, id DESC`
    );
    res.json(rows || []);
  } catch (e) {
    sendServerError(res, '[BUCKET CHOFER] Error:', e);
  }
});

// Lavado: en lavado
router.get('/bucket/lavado', async (_req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT * FROM bikes WHERE COALESCE(status, estado) = 'lavado' ORDER BY updatedAt DESC, id DESC`
    );
    res.json(rows || []);
  } catch (e) {
    sendServerError(res, '[BUCKET LAVADO] Error:', e);
  }
});

// Mecánico: por cotizar / en cotización / en reparación
router.get('/bucket/mecanico', async (_req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT * FROM bikes
        WHERE COALESCE(status, estado) IN ('por cotizar','en cotizacion','en reparacion')
        ORDER BY FIELD(COALESCE(status, estado),'por cotizar','en cotizacion','en reparacion'), updatedAt DESC, id DESC`
    );
    res.json(rows || []);
  } catch (e) {
    sendServerError(res, '[BUCKET MECANICO] Error:', e);
  }
});

/* =========================
   COMENTARIOS
   =========================
   Tabla "comments" (id, bikeId, userId, comment, createdAt) NOT NULL userId.
   - GET /:id/comments
   - POST /:id/comments  { body?: string, comment?: string }
   Nota: Si no hay auth, asignamos userId=1 (admin) para evitar violar NOT NULL.
*/

// GET /api/bikes/:id/comments
router.get('/:id/comments', async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT id, bikeId, userId, comment AS body, createdAt
         FROM comments
        WHERE bikeId = ?
        ORDER BY createdAt DESC, id DESC`,
      [req.params.id]
    );
    res.json(rows || []);
  } catch (e) {
    sendServerError(res, '[COMMENTS LIST] Error:', e);
  }
});

// POST /api/bikes/:id/comments
router.post('/:id/comments', async (req, res) => {
  try {
    // tolerancia: { body } o { comment }
    const body = (req.body?.body ?? req.body?.comment ?? '').trim();
    if (!body) return res.status(400).json({ error: 'Comentario vacío' });

    const userId = req.user?.id ?? 1; // si tienes auth, cámbialo a req.user.id
    await db.query(
      'INSERT INTO comments (bikeId, userId, comment) VALUES (?, ?, ?)',
      [req.params.id, userId, body]
    );
    res.status(201).json({ ok: true });
  } catch (e) {
    sendServerError(res, '[COMMENTS CREATE] Error:', e);
  }
});

export default router;
