import express from 'express';
import {
  getBikes,
  addBike,
  updateBike,
  updateBikeStatus,
  deleteBike
} from '../controllers/bikeController.js';

const router = express.Router();

router.get('/', getBikes);
router.post('/', addBike);
router.put('/:id', updateBike);          // para editar bicicleta completa
router.put('/status/:id', updateBikeStatus); // si solo actualizas status
router.delete('/:id', deleteBike);

export default router;
