import { v4 as uuid } from 'uuid';
import { parse } from 'csv-parse/sync';
import db from './db.js';
import { lookupPlace } from './places.js';

export async function importBatch(
  csvBuffer: Buffer,
  filename: string,
  templateId: string
): Promise<{ batchId: string; taskCount: number }> {
  const records: Record<string, string>[] = parse(csvBuffer.toString(), {
    columns: true,
    skip_empty_lines: true,
  });

  // Enrich with Google Places data if API key is available
  const googleApiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (googleApiKey) {
    console.log(`Enriching ${records.length} records with Google Places data...`);
    for (const row of records) {
      if (row.business_name && row.address) {
        const details = await lookupPlace(row.business_name, row.address, googleApiKey);
        if (details.website_url) row.website_url = details.website_url;
        if (details.google_phone) row.google_phone = details.google_phone;
        if (details.google_place_id) row.google_place_id = details.google_place_id;
      }
    }
    console.log('Enrichment complete.');
  }

  const batchId = uuid();
  const now = new Date().toISOString();

  const insertBatch = db.prepare(
    'INSERT INTO batches (id, template_id, source_file, status, created_at) VALUES (?, ?, ?, ?, ?)'
  );
  const insertTask = db.prepare(
    'INSERT INTO tasks (id, batch_id, input_json, status) VALUES (?, ?, ?, ?)'
  );

  db.transaction(() => {
    insertBatch.run(batchId, templateId, filename, 'active', now);
    for (const row of records) {
      insertTask.run(uuid(), batchId, JSON.stringify(row), 'unassigned');
    }
  })();

  return { batchId, taskCount: records.length };
}
