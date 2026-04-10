import { Router } from 'express';
import db from '../db.js';

const router = Router();

// List all operators
router.get('/', (_req, res) => {
  const rows = db.prepare('SELECT * FROM operators ORDER BY name').all();
  res.json(rows);
});

// Get single operator
router.get('/:id', (req, res) => {
  const op = db.prepare('SELECT * FROM operators WHERE id = ?').get(req.params.id);
  if (!op) {
    res.status(404).json({ error: 'Operator not found' });
    return;
  }
  res.json(op);
});

export default router;
