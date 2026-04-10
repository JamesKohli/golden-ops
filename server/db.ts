import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.resolve(__dirname, '..', 'golden-ops.db');

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Run migrations
db.exec(`
  CREATE TABLE IF NOT EXISTS templates (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    version INTEGER NOT NULL,
    yaml_content TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS batches (
    id TEXT PRIMARY KEY,
    template_id TEXT NOT NULL REFERENCES templates(id),
    source_file TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active',
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS operators (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    accuracy_score REAL,
    tasks_completed INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY,
    batch_id TEXT NOT NULL REFERENCES batches(id),
    input_json TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'unassigned',
    assigned_to TEXT REFERENCES operators(id),
    started_at TEXT,
    completed_at TEXT,
    flag_reason TEXT
  );

  CREATE TABLE IF NOT EXISTS step_responses (
    id TEXT PRIMARY KEY,
    task_id TEXT NOT NULL REFERENCES tasks(id),
    step_id TEXT NOT NULL,
    value_json TEXT NOT NULL,
    evidence_path TEXT,
    timestamp TEXT NOT NULL,
    UNIQUE(task_id, step_id)
  );

  CREATE TABLE IF NOT EXISTS qa_pairs (
    id TEXT PRIMARY KEY,
    task_id TEXT NOT NULL REFERENCES tasks(id),
    operator_1 TEXT NOT NULL REFERENCES operators(id),
    operator_2 TEXT REFERENCES operators(id),
    agreed INTEGER,
    reviewer_id TEXT REFERENCES operators(id),
    resolved_value_json TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
  CREATE INDEX IF NOT EXISTS idx_tasks_batch ON tasks(batch_id);
  CREATE INDEX IF NOT EXISTS idx_tasks_assigned ON tasks(assigned_to);
  CREATE INDEX IF NOT EXISTS idx_step_responses_task ON step_responses(task_id);
`);

// Seed demo operator
const demoOperator = db.prepare('SELECT id FROM operators WHERE email = ?').get('demo@goldenops.local');
if (!demoOperator) {
  db.prepare(
    'INSERT INTO operators (id, name, email, tasks_completed) VALUES (?, ?, ?, 0)'
  ).run('op_demo', 'Demo Operator', 'demo@goldenops.local');
}

// Auto-seed the example template if no templates exist
import fs from 'fs';
const templateCount = (db.prepare('SELECT COUNT(*) as count FROM templates').get() as { count: number }).count;
if (templateCount === 0) {
  const seedPath = path.resolve(__dirname, '..', 'templates', 'verify_phone_from_website.yaml');
  if (fs.existsSync(seedPath)) {
    const yamlContent = fs.readFileSync(seedPath, 'utf-8');
    const now = new Date().toISOString();
    db.prepare(
      'INSERT INTO templates (id, name, version, yaml_content, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
    ).run('tmpl_phone_verify', 'verify_phone_from_website', 1, yamlContent, now, now);
    console.log('Seeded example template: verify_phone_from_website');
  }
}

export function resetDatabase() {
  // Drop all data in reverse FK order
  db.exec(`
    DELETE FROM step_responses;
    DELETE FROM qa_pairs;
    DELETE FROM tasks;
    DELETE FROM batches;
    DELETE FROM templates;
    DELETE FROM operators;
  `);

  // Re-seed operator
  db.prepare(
    'INSERT INTO operators (id, name, email, tasks_completed) VALUES (?, ?, ?, 0)'
  ).run('op_demo', 'Demo Operator', 'demo@goldenops.local');

  // Re-seed template
  const seedPath = path.resolve(__dirname, '..', 'templates', 'verify_phone_from_website.yaml');
  if (fs.existsSync(seedPath)) {
    const yamlContent = fs.readFileSync(seedPath, 'utf-8');
    const now = new Date().toISOString();
    db.prepare(
      'INSERT INTO templates (id, name, version, yaml_content, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
    ).run('tmpl_phone_verify', 'verify_phone_from_website', 1, yamlContent, now, now);
  }
}

export default db;
