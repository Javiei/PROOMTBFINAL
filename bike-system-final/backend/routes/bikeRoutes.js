// src/server/routes/bikeRoutes.js
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

const LEGACY_MAP = new Map([
  ['ingresada', 'chofer'],
  ['en_revision', 'por cotizar'],
  ['en_reparacion', 'en reparacion'],
  ['entregado', 'terminado'],
  ['en_cotizacion', 'en cotizacion'],
  ['delivery', 'tienda'],
  ['ruta', 'tienda'],
]);

/** Normaliza a un estado canónico (lowercase + trim + legacy).
 *  Devuelve el estado canónico o null si no es válido.
 */
const normalizeStatus = (raw) => {
  if (raw == null) return null;
  const sRaw = String(raw).trim();
  const s = sRaw.toLowerCase();
  if (VALID_STATUSES.has(s)) return s;
  if (LEGACY_MAP.has(s)) return LEGACY_MAP.get(s);
  return null;
};

const toDate = (v) => {
  if (!v) return null;
  const s = String(v).slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
};

const sendServerError = (res, tag, e) => {
  console.error(tag, { code: e?.code, msg: e?.sqlMessage, stack: e?.stack });
  res.status(500).json({ error: 'Error de servidor', code: e?.code, msg: e?.sqlMessage });
};

// Helper para SELECT estándar con alias
const BIKE_SELECT = `
  SELECT
    id,
    clientName, clientLastName, phoneNumber, email, address,
    bikeModel, bikeBrand, description, problem, assignedTo,
    status,
    entry_date  AS entryDate,
    comentario, numeroFactura,
    created_at  AS createdAt,
    updated_at  AS updatedAt
  FROM bikes
`;

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

router.get('/tienda', async (_req, res) => {
  try {
    const [rows] = await db.query(
      `${BIKE_SELECT}
       WHERE TRIM(LOWER(status)) IN ('listo_tienda','tienda','terminado')
       ORDER BY updated_at DESC, id DESC`
    );

    const out = (rows || []).map(r => ({
      ...r,
      status: normalizeStatus(r.status) || r.status,
      entryDate: toDate(r.entryDate),
    }));

    res.json(out);
  } catch (e) {
    sendServerError(res, '[TIENDA LIST] Error:', e);
  }
});

router.get('/tienda/stats', async (_req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT TRIM(LOWER(status)) AS status, COUNT(*) AS count
         FROM bikes
        WHERE TRIM(LOWER(status)) IN ('listo_tienda','tienda','terminado')
        GROUP BY TRIM(LOWER(status))
        ORDER BY count DESC`
    );

    const out = (rows || []).map(r => ({
      status: normalizeStatus(r.status) || r.status,
      count: r.count,
    }));

    res.json(out);
  } catch (e) {
    sendServerError(res, '[TIENDA STATS] Error:', e);
  }
});

/* =========================
   CRUD BÁSICO DE BIKES
   ========================= */

router.get('/', async (_req, res) => {
  try {
    const [rows] = await db.query(
      `${BIKE_SELECT}
       ORDER BY updated_at DESC, id DESC`
    );
    const out = (rows || []).map(r => ({
      ...r,
      status: normalizeStatus(r.status) || r.status,
      entryDate: toDate(r.entryDate),
    }));

    res.json(out);
  } catch (e) {
    sendServerError(res, '[BIKES LIST] Error:', e);
  }
});

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
        status, entry_date, clientId, comentario, numeroFactura)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        clientName || null, clientLastName || null, phoneNumber || null, email || null, address || null,
        bikeModel || null, bikeBrand || null, description || null, problem || null, assignedTo || null,
        sNorm, dateStr, clientId || null, comentario || null, numeroFactura || null
      ]
    );

    const id = result?.insertId;
    const [[row]] = await db.query(
      `${BIKE_SELECT}
       WHERE id = ? LIMIT 1`,
      [id]
    );
    // Normalizamos también la respuesta
    const out = row ? {
      ...row,
      status: normalizeStatus(row.status) || row.status,
      entryDate: toDate(row.entryDate),
    } : null;

    return res.status(201).json(out);
  } catch (e) {
    sendServerError(res, '[BIKES CREATE] Error:', e);
  }
});

router.get('/:id', async (req, res) => {
  try {
    const [[row]] = await db.query(
      `${BIKE_SELECT}
       WHERE id = ? LIMIT 1`,
      [req.params.id]
    );
    if (!row) return res.status(404).json({ error: 'No encontrado' });

    row.status = normalizeStatus(row.status) || row.status;
    row.entryDate = toDate(row.entryDate);
    res.json(row);
  } catch (e) {
    sendServerError(res, '[BIKE GET] Error:', e);
  }
});

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
    setParts.push('`entry_date` = ?'); // columna real en MySQL
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

router.delete('/:id', async (req, res) => {
  try {
    // Validación estricta de entero positivo
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: 'ID inválido' });
    }

    // La PK de la tabla es 'id'
    const [result] = await db.query('DELETE FROM bikes WHERE id = ?', [id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'No encontrado' });
    }
    res.json({ ok: true, deletedId: id });
  } catch (e) {
    sendServerError(res, '[BIKE DELETE] Error:', e);
  }
});

/* =========================
   BUCKETS POR ROL
   ========================= */

router.get('/bucket/chofer', async (_req, res) => {
  try {
    const [rows] = await db.query(
      `${BIKE_SELECT}
       WHERE TRIM(LOWER(status)) = 'chofer'
       ORDER BY updated_at DESC, id DESC`
    );
    const out = (rows || []).map(r => ({
      ...r,
      status: normalizeStatus(r.status) || r.status,
      entryDate: toDate(r.entryDate),
    }));
    res.json(out);
  } catch (e) {
    sendServerError(res, '[BUCKET CHOFER] Error:', e);
  }
});

router.get('/bucket/lavado', async (_req, res) => {
  try {
    const [rows] = await db.query(
      `${BIKE_SELECT}
       WHERE TRIM(LOWER(status)) = 'lavado'
       ORDER BY updated_at DESC, id DESC`
    );
    const out = (rows || []).map(r => ({
      ...r,
      status: normalizeStatus(r.status) || r.status,
      entryDate: toDate(r.entryDate),
    }));
    res.json(out);
  } catch (e) {
    sendServerError(res, '[BUCKET LAVADO] Error:', e);
  }
});

router.get('/bucket/mecanico', async (_req, res) => {
  try {
    const [rows] = await db.query(
      `${BIKE_SELECT}
       WHERE TRIM(LOWER(status)) IN ('por cotizar','en cotizacion','en reparacion')
       ORDER BY FIELD(TRIM(LOWER(status)),'por cotizar','en cotizacion','en reparacion'),
                updated_at DESC, id DESC`
    );
    const out = (rows || []).map(r => ({
      ...r,
      status: normalizeStatus(r.status) || r.status,
      entryDate: toDate(r.entryDate),
    }));
    res.json(out);
  } catch (e) {
    sendServerError(res, '[BUCKET MECANICO] Error:', e);
  }
});

export default router;
