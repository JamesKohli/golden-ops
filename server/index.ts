import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { resetDatabase } from './db.js';
import { importBatch } from './batch-import.js';
import templateRoutes from './routes/templates.js';
import batchRoutes from './routes/batches.js';
import taskRoutes from './routes/tasks.js';
import operatorRoutes from './routes/operators.js';
import exportRoutes from './routes/export.js';
import vibeRoutes from './routes/vibe.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// API routes
app.use('/api/templates', templateRoutes);
app.use('/api/batches', batchRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/operators', operatorRoutes);
app.use('/api/export', exportRoutes);
app.use('/api/vibe', vibeRoutes);

// Reset demo
app.post('/api/reset', async (_req, res) => {
  resetDatabase();
  // Re-import sample CSV
  const csvPath = path.resolve(__dirname, '..', 'sample_batch.csv');
  if (fs.existsSync(csvPath)) {
    const csvBuffer = fs.readFileSync(csvPath);
    await importBatch(csvBuffer, 'sample_batch.csv', 'tmpl_phone_verify');
  }
  res.json({ ok: true });
});

// Serve evidence files
app.use('/evidence', express.static(path.resolve(__dirname, '..', 'evidence')));

// In production, serve Vite build
const clientDist = path.resolve(__dirname, '..', 'dist', 'client');
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  // SPA fallback — only for non-API, non-evidence routes
  app.get('/{*path}', (req, res, next) => {
    if (req.path.startsWith('/api/') || req.path.startsWith('/evidence/')) return next();
    res.sendFile(path.resolve(clientDist, 'index.html'));
  });
}

const PORT = process.env.PORT || 3001;

// Auto-seed sample data on first boot if DB is empty
async function autoSeed() {
  const { default: db } = await import('./db.js');
  const batchCount = (db.prepare('SELECT COUNT(*) as count FROM batches').get() as { count: number }).count;
  if (batchCount === 0) {
    const csvPath = path.resolve(__dirname, '..', 'sample_batch.csv');
    if (fs.existsSync(csvPath)) {
      console.log('Auto-seeding sample batch...');
      const csvBuffer = fs.readFileSync(csvPath);
      await importBatch(csvBuffer, 'sample_batch.csv', 'tmpl_phone_verify');
      console.log('Sample batch seeded.');
    }
  }
}

app.listen(PORT, async () => {
  console.log(`Golden Ops server running on http://localhost:${PORT}`);
  await autoSeed();
});
