import express from 'express';
import cors from 'cors';
import helmet from 'helmet';

import authRoutes from './routes/authRoutes.js';
import bikeRoutes from './routes/bikeRoutes.js';

const app = express();
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(helmet());

// health
app.get('/api/health/db', (_req, res) => res.json({ ok: true }));

// rutas
app.use('/api/auth', authRoutes);
app.use('/api/bikes', bikeRoutes);

const PORT = process.env.PORT || 4000;
app.listen(PORT, '127.0.0.1', () => {
  console.log(`[BOOT] Backend listening on http://127.0.0.1:${PORT}`);
});

export default app;
