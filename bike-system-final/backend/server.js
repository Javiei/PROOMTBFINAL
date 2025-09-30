import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import db from './db.js';
import authRoutes from './routes/authRoutes.js';
import bikeRoutes from './routes/bikeRoutes.js';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

app.use((req, _res, next) => { console.log('REQ', req.method, req.url); next(); });

app.get('/api/health', (_req, res) => res.json({ ok: true }));

app.use('/api/auth', authRoutes);
app.use('/api/bikes', bikeRoutes);

// 404 solo para /api
app.use(/^\/api\//, (_req, res) => res.status(404).json({ error: 'Not found' }));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Servidor corriendo en puerto ${PORT}`));
