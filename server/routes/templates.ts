import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import db from '../db.js';
import { parseTemplate } from '../../shared/engine.js';
import type { TemplateRow } from '../../shared/types.js';

const router = Router();

// List all templates (summary, no yaml_content)
router.get('/', (_req, res) => {
  const rows = db.prepare(
    'SELECT id, name, version, created_at, updated_at FROM templates ORDER BY updated_at DESC'
  ).all();
  res.json(rows);
});

// Get single template with parsed definition
router.get('/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM templates WHERE id = ?').get(req.params.id) as TemplateRow | undefined;
  if (!row) {
    res.status(404).json({ error: 'Template not found' });
    return;
  }
  const parsed = parseTemplate(row.yaml_content);
  res.json({ ...row, parsed });
});

// Create template from YAML
router.post('/', (req, res) => {
  const { yaml_content } = req.body;
  if (!yaml_content) {
    res.status(400).json({ error: 'yaml_content is required' });
    return;
  }

  let parsed;
  try {
    parsed = parseTemplate(yaml_content);
  } catch (e: any) {
    res.status(400).json({ error: `Invalid template: ${e.message}` });
    return;
  }

  const id = uuid();
  const now = new Date().toISOString();
  db.prepare(
    'INSERT INTO templates (id, name, version, yaml_content, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(id, parsed.name, parsed.version, yaml_content, now, now);

  res.status(201).json({ id, name: parsed.name, version: parsed.version });
});

// Update template YAML
router.put('/:id', (req, res) => {
  const { yaml_content } = req.body;
  if (!yaml_content) {
    res.status(400).json({ error: 'yaml_content is required' });
    return;
  }

  const existing = db.prepare('SELECT id FROM templates WHERE id = ?').get(req.params.id);
  if (!existing) {
    res.status(404).json({ error: 'Template not found' });
    return;
  }

  let parsed;
  try {
    parsed = parseTemplate(yaml_content);
  } catch (e: any) {
    res.status(400).json({ error: `Invalid template: ${e.message}` });
    return;
  }

  const now = new Date().toISOString();
  db.prepare(
    'UPDATE templates SET yaml_content = ?, name = ?, version = ?, updated_at = ? WHERE id = ?'
  ).run(yaml_content, parsed.name, parsed.version, now, req.params.id);

  res.json({ id: req.params.id, name: parsed.name, version: parsed.version });
});

// Delete template
router.delete('/:id', (req, res) => {
  const linked = db.prepare('SELECT id FROM batches WHERE template_id = ? LIMIT 1').get(req.params.id);
  if (linked) {
    res.status(409).json({ error: 'Cannot delete template with linked batches' });
    return;
  }

  const result = db.prepare('DELETE FROM templates WHERE id = ?').run(req.params.id);
  if (result.changes === 0) {
    res.status(404).json({ error: 'Template not found' });
    return;
  }
  res.status(204).send();
});

export default router;
