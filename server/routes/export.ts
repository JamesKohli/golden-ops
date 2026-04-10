import { Router } from 'express';
import db from '../db.js';
import { parseTemplate, resolveVariable, buildStepContext } from '../../shared/engine.js';
import type { TemplateRow, TaskRow, StepResponseRow } from '../../shared/types.js';

const router = Router();

// Export completed tasks as JSONL
router.get('/:batchId', (req, res) => {
  const batch = db.prepare('SELECT * FROM batches WHERE id = ?').get(req.params.batchId) as any;
  if (!batch) {
    res.status(404).json({ error: 'Batch not found' });
    return;
  }

  const templateRow = db.prepare('SELECT * FROM templates WHERE id = ?').get(batch.template_id) as TemplateRow;
  const template = parseTemplate(templateRow.yaml_content);

  const tasks = db.prepare(
    "SELECT * FROM tasks WHERE batch_id = ? AND status = 'completed'"
  ).all(req.params.batchId) as TaskRow[];

  res.setHeader('Content-Type', 'application/x-ndjson');
  res.setHeader('Content-Disposition', `attachment; filename="goldens_${req.params.batchId}.jsonl"`);

  for (const task of tasks) {
    const stepResponses = db.prepare(
      'SELECT * FROM step_responses WHERE task_id = ?'
    ).all(task.id) as StepResponseRow[];

    const responses: Record<string, any> = {};
    const evidencePaths: string[] = [];
    for (const sr of stepResponses) {
      responses[sr.step_id] = JSON.parse(sr.value_json);
      if (sr.evidence_path) evidencePaths.push(sr.evidence_path);
    }

    const input = JSON.parse(task.input_json);
    const context = buildStepContext(responses, input);

    // Resolve output_schema
    const golden: Record<string, any> = {};
    for (const [key, tmpl] of Object.entries(template.output_schema)) {
      golden[key] = resolveVariable(tmpl, context);
    }

    const line = JSON.stringify({
      eval_id: task.id,
      workflow: template.name,
      workflow_version: template.version,
      input,
      golden,
      metadata: {
        operator_id: task.assigned_to,
        completed_at: task.completed_at,
        duration_seconds: task.started_at && task.completed_at
          ? Math.round((new Date(task.completed_at).getTime() - new Date(task.started_at).getTime()) / 1000)
          : null,
        evidence: evidencePaths,
      },
    });

    res.write(line + '\n');
  }

  res.end();
});

export default router;
