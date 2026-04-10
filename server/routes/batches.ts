import { Router } from 'express';
import multer from 'multer';
import db from '../db.js';
import { importBatch } from '../batch-import.js';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

// Create batch from CSV upload
router.post('/', upload.single('file'), async (req, res) => {
  const file = req.file;
  const templateId = req.body.template_id;

  if (!file) {
    res.status(400).json({ error: 'CSV file is required' });
    return;
  }
  if (!templateId) {
    res.status(400).json({ error: 'template_id is required' });
    return;
  }

  const template = db.prepare('SELECT id FROM templates WHERE id = ?').get(templateId);
  if (!template) {
    res.status(404).json({ error: 'Template not found' });
    return;
  }

  try {
    const result = await importBatch(file.buffer, file.originalname || 'upload.csv', templateId);
    res.status(201).json({ id: result.batchId, task_count: result.taskCount, template_id: templateId });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

// List all batches with stats
router.get('/', (_req, res) => {
  const rows = db.prepare(`
    SELECT
      b.*,
      t.name as template_name,
      COUNT(tk.id) as total_tasks,
      SUM(CASE WHEN tk.status = 'completed' THEN 1 ELSE 0 END) as completed_tasks,
      SUM(CASE WHEN tk.status = 'in_progress' OR tk.status = 'assigned' THEN 1 ELSE 0 END) as in_progress_tasks
    FROM batches b
    LEFT JOIN templates t ON t.id = b.template_id
    LEFT JOIN tasks tk ON tk.batch_id = b.id
    GROUP BY b.id
    ORDER BY b.created_at DESC
  `).all();
  res.json(rows);
});

// Get single batch with tasks
router.get('/:id', (req, res) => {
  const batch = db.prepare('SELECT * FROM batches WHERE id = ?').get(req.params.id);
  if (!batch) {
    res.status(404).json({ error: 'Batch not found' });
    return;
  }
  const tasks = db.prepare(
    'SELECT id, status, assigned_to, started_at, completed_at FROM tasks WHERE batch_id = ? ORDER BY rowid'
  ).all(req.params.id);
  res.json({ ...batch, tasks });
});

export default router;
