import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import db from '../db.js';
import { parseTemplate } from '../../shared/engine.js';
import type { TemplateRow, TaskRow, StepResponseRow } from '../../shared/types.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const evidenceDir = path.resolve(__dirname, '..', '..', 'evidence');

const router = Router();

// List tasks with filtering
router.get('/', (req, res) => {
  const { status, batch_id, assigned_to, limit = '50', offset = '0' } = req.query;
  let sql = 'SELECT * FROM tasks WHERE 1=1';
  const params: any[] = [];

  if (status) { sql += ' AND status = ?'; params.push(status); }
  if (batch_id) { sql += ' AND batch_id = ?'; params.push(batch_id); }
  if (assigned_to) { sql += ' AND assigned_to = ?'; params.push(assigned_to); }

  sql += ' ORDER BY rowid ASC LIMIT ? OFFSET ?';
  params.push(Number(limit), Number(offset));

  const rows = db.prepare(sql).all(...params);
  res.json(rows);
});

// Get single task with template + responses
router.get('/:id', (req, res) => {
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id) as TaskRow | undefined;
  if (!task) {
    res.status(404).json({ error: 'Task not found' });
    return;
  }

  // Get template via batch
  const batch = db.prepare('SELECT template_id FROM batches WHERE id = ?').get(task.batch_id) as { template_id: string } | undefined;
  if (!batch) {
    res.status(500).json({ error: 'Batch not found for task' });
    return;
  }

  const templateRow = db.prepare('SELECT * FROM templates WHERE id = ?').get(batch.template_id) as TemplateRow | undefined;
  if (!templateRow) {
    res.status(500).json({ error: 'Template not found for batch' });
    return;
  }

  const template = parseTemplate(templateRow.yaml_content);

  // Inject env vars into data source URL templates
  const googleMapsKey = process.env.GOOGLE_MAPS_API_KEY || '';
  for (const ds of template.data_sources) {
    ds.url_template = ds.url_template.replace('GOOGLE_MAPS_API_KEY', googleMapsKey);
  }

  // Get all step responses
  const stepResponses = db.prepare(
    'SELECT * FROM step_responses WHERE task_id = ?'
  ).all(task.id) as StepResponseRow[];

  const responses: Record<string, any> = {};
  for (const sr of stepResponses) {
    responses[sr.step_id] = JSON.parse(sr.value_json);
  }

  res.json({
    ...task,
    input: JSON.parse(task.input_json),
    template,
    template_id: batch.template_id,
    responses,
  });
});

// Claim next unassigned task
router.post('/claim', (req, res) => {
  const { operator_id, template_id } = req.body;
  if (!operator_id) {
    res.status(400).json({ error: 'operator_id is required' });
    return;
  }

  let sql = `
    SELECT t.* FROM tasks t
    JOIN batches b ON b.id = t.batch_id
    WHERE t.status = 'unassigned' AND b.status = 'active'
  `;
  const params: any[] = [];

  if (template_id) {
    sql += ' AND b.template_id = ?';
    params.push(template_id);
  }
  sql += ' ORDER BY t.rowid ASC LIMIT 1';

  const task = db.prepare(sql).get(...params) as TaskRow | undefined;
  if (!task) {
    res.status(404).json({ error: 'No tasks available' });
    return;
  }

  const now = new Date().toISOString();
  db.prepare(
    "UPDATE tasks SET status = 'in_progress', assigned_to = ?, started_at = ? WHERE id = ? AND status = 'unassigned'"
  ).run(operator_id, now, task.id);

  // Return full task details
  const batch = db.prepare('SELECT template_id FROM batches WHERE id = ?').get(task.batch_id) as { template_id: string };
  const templateRow = db.prepare('SELECT * FROM templates WHERE id = ?').get(batch.template_id) as TemplateRow;
  const template = parseTemplate(templateRow.yaml_content);

  // Inject env vars into data source URL templates
  const googleMapsKey = process.env.GOOGLE_MAPS_API_KEY || '';
  for (const ds of template.data_sources) {
    ds.url_template = ds.url_template.replace('GOOGLE_MAPS_API_KEY', googleMapsKey);
  }

  res.json({
    ...task,
    status: 'in_progress',
    assigned_to: operator_id,
    started_at: now,
    input: JSON.parse(task.input_json),
    template,
    template_id: batch.template_id,
    responses: {},
  });
});

// Submit a step response (upsert)
router.post('/:id/steps/:stepId', (req, res) => {
  const { id: taskId, stepId } = req.params;
  const { value } = req.body;

  const task = db.prepare('SELECT id, status FROM tasks WHERE id = ?').get(taskId) as TaskRow | undefined;
  if (!task) {
    res.status(404).json({ error: 'Task not found' });
    return;
  }

  // Upsert: check if response exists
  const existing = db.prepare(
    'SELECT id FROM step_responses WHERE task_id = ? AND step_id = ?'
  ).get(taskId, stepId) as { id: string } | undefined;

  const now = new Date().toISOString();
  const valueJson = JSON.stringify(value);

  if (existing) {
    db.prepare(
      'UPDATE step_responses SET value_json = ?, timestamp = ? WHERE id = ?'
    ).run(valueJson, now, existing.id);
  } else {
    db.prepare(
      'INSERT INTO step_responses (id, task_id, step_id, value_json, timestamp) VALUES (?, ?, ?, ?, ?)'
    ).run(uuid(), taskId, stepId, valueJson, now);
  }

  res.json({ ok: true });
});

// Complete a task
router.post('/:id/complete', (req, res) => {
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id) as TaskRow | undefined;
  if (!task) {
    res.status(404).json({ error: 'Task not found' });
    return;
  }

  // Get template to check required steps
  const batch = db.prepare('SELECT template_id FROM batches WHERE id = ?').get(task.batch_id) as { template_id: string };
  const templateRow = db.prepare('SELECT * FROM templates WHERE id = ?').get(batch.template_id) as TemplateRow;
  const template = parseTemplate(templateRow.yaml_content);

  const submittedSteps = db.prepare(
    'SELECT step_id FROM step_responses WHERE task_id = ?'
  ).all(task.id) as { step_id: string }[];
  const submittedIds = new Set(submittedSteps.map(s => s.step_id));

  const missingRequired = template.steps
    .filter(s => s.required !== false && !submittedIds.has(s.id))
    .map(s => s.id);

  if (missingRequired.length > 0) {
    res.status(400).json({ error: 'Missing required steps', missing: missingRequired });
    return;
  }

  const now = new Date().toISOString();
  db.prepare(
    "UPDATE tasks SET status = 'completed', completed_at = ? WHERE id = ?"
  ).run(now, task.id);

  if (task.assigned_to) {
    db.prepare(
      'UPDATE operators SET tasks_completed = tasks_completed + 1 WHERE id = ?'
    ).run(task.assigned_to);
  }

  res.json({ ok: true, completed_at: now });
});

// Flag a task
router.post('/:id/flag', (req, res) => {
  const { reason } = req.body;
  const result = db.prepare(
    "UPDATE tasks SET status = 'flagged', flag_reason = ? WHERE id = ?"
  ).run(reason || null, req.params.id);

  if (result.changes === 0) {
    res.status(404).json({ error: 'Task not found' });
    return;
  }
  res.json({ ok: true });
});

// Upload evidence for a step
const upload = multer({ storage: multer.memoryStorage() });
router.post('/:id/evidence/:stepId', upload.single('file'), (req, res) => {
  const { id: taskId, stepId } = req.params;
  const file = req.file;
  if (!file) {
    res.status(400).json({ error: 'File is required' });
    return;
  }

  const taskDir = path.join(evidenceDir, taskId);
  fs.mkdirSync(taskDir, { recursive: true });

  const ext = path.extname(file.originalname || '.png') || '.png';
  const filename = `${stepId}_screenshot${ext}`;
  const filepath = path.join(taskDir, filename);
  fs.writeFileSync(filepath, file.buffer);

  const relativePath = `evidence/${taskId}/${filename}`;

  // Update step_response with evidence path
  db.prepare(
    'UPDATE step_responses SET evidence_path = ? WHERE task_id = ? AND step_id = ?'
  ).run(relativePath, taskId, stepId);

  res.json({ path: relativePath });
});

export default router;
