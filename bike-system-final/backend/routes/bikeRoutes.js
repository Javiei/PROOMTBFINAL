import express from 'express';
import { getBikes, updateBikeStatus } from '../controllers/bikeController.js';
const router = express.Router();
router.get('/', getBikes);
router.put('/:id', updateBikeStatus);
export default router;