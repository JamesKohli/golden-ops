import { Router } from 'express';
import Anthropic from '@anthropic-ai/sdk';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import db from '../db.js';
import type { TemplateRow } from '../../shared/types.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const customComponentsDir = path.resolve(__dirname, '..', '..', 'custom-components');
const router = Router();

const SYSTEM_PROMPT = `You are a workflow template editor for a golden dataset operations tool. You help admins modify YAML workflow templates and create custom React components.

## Template Format
Templates are YAML files with: name, version, description, data_sources, panels, steps, qa, output_schema.
Each step has: id, instruction, input_type, output_key, and optional: evidence, prefill_from, required.

Built-in input_types: enum [option1, option2], string[], phone, url, text
Custom input_types use: custom:component_name

## Custom Component Contract
Custom components must implement this interface and be a default export:
\`\`\`typescript
interface StepInputProps<T> {
  value: T;
  onChange: (val: T) => void;
  context: Record<string, any>; // all resolved template variables
  evidence: {
    attachScreenshot: (dataUrl: string) => void;
    attachNote: (text: string) => void;
  };
}
\`\`\`

## Response Format
You MUST respond with ONLY a valid JSON object and nothing else — no markdown, no explanation outside the JSON.

CRITICAL: The "updated_yaml" value must be a single JSON string with newlines escaped as \\n. Do NOT use a YAML block or multi-line string — it must be a single-line JSON string value.

Example response format:
{"updated_yaml": "name: my_workflow\\nversion: 1\\nsteps:\\n  - id: step1\\n    instruction: \\"Do something\\"\\n    input_type: text\\n    output_key: result", "explanation": "Added a new step", "new_components": []}

The new_components array should be empty if no custom components are needed. Each component needs "name" and "code" fields.`;

// Generate template modification via Claude
router.post('/', async (req, res) => {
  const { template_id, request } = req.body;
  if (!template_id || !request) {
    res.status(400).json({ error: 'template_id and request are required' });
    return;
  }

  const templateRow = db.prepare('SELECT * FROM templates WHERE id = ?').get(template_id) as TemplateRow | undefined;
  if (!templateRow) {
    res.status(404).json({ error: 'Template not found' });
    return;
  }

  // List existing custom components
  let existingComponents: string[] = [];
  try {
    existingComponents = fs.readdirSync(customComponentsDir)
      .filter(f => f.endsWith('.tsx'))
      .map(f => f.replace('.tsx', ''));
  } catch { /* dir may not exist */ }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: 'ANTHROPIC_API_KEY not set. Set it as an environment variable.' });
    return;
  }

  const client = new Anthropic({ apiKey });

  try {
    const message = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: `Current template YAML:\n\`\`\`yaml\n${templateRow.yaml_content}\n\`\`\`\n\nExisting custom components: ${existingComponents.length > 0 ? existingComponents.join(', ') : 'none'}\n\nRequest: ${request}`,
        },
      ],
    });

    const text = message.content[0].type === 'text' ? message.content[0].text : '';

    // Robustly extract JSON from Claude's response
    let parsed: any = null;

    // Try 1: Direct JSON parse
    try { parsed = JSON.parse(text.trim()); } catch {}

    // Try 2: Extract from ```json ... ``` code block
    if (!parsed) {
      const codeBlockMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
      if (codeBlockMatch) {
        try { parsed = JSON.parse(codeBlockMatch[1].trim()); } catch {}
      }
    }

    // Try 3: Find the outermost { ... } in the text
    if (!parsed) {
      const firstBrace = text.indexOf('{');
      const lastBrace = text.lastIndexOf('}');
      if (firstBrace !== -1 && lastBrace > firstBrace) {
        try { parsed = JSON.parse(text.slice(firstBrace, lastBrace + 1)); } catch {}
      }
    }

    // Try 4: Extract fields manually with regex
    if (!parsed) {
      const yamlMatch = text.match(/["']?updated_yaml["']?\s*:\s*["'`]([\s\S]*?)["'`]\s*[,}]/);
      const explMatch = text.match(/["']?explanation["']?\s*:\s*["'`]([\s\S]*?)["'`]\s*[,}]/);
      if (yamlMatch) {
        parsed = {
          updated_yaml: yamlMatch[1],
          explanation: explMatch ? explMatch[1] : 'Changes applied.',
          new_components: [],
        };
      }
    }

    if (!parsed || !parsed.updated_yaml) {
      res.status(500).json({ error: 'Failed to parse Claude response', raw: text.slice(0, 2000) });
      return;
    }

    res.json({
      updated_yaml: parsed.updated_yaml,
      explanation: parsed.explanation || 'Changes applied.',
      new_components: parsed.new_components || [],
      original_yaml: templateRow.yaml_content,
    });
  } catch (e: any) {
    res.status(500).json({ error: `Claude API error: ${e.message}` });
  }
});

// Apply approved changes
router.post('/approve', (req, res) => {
  const { template_id, updated_yaml, new_components } = req.body;
  if (!template_id || !updated_yaml) {
    res.status(400).json({ error: 'template_id and updated_yaml are required' });
    return;
  }

  // Update template
  const now = new Date().toISOString();
  db.prepare(
    'UPDATE templates SET yaml_content = ?, updated_at = ? WHERE id = ?'
  ).run(updated_yaml, now, template_id);

  // Write new components
  if (new_components && Array.isArray(new_components)) {
    fs.mkdirSync(customComponentsDir, { recursive: true });
    for (const comp of new_components) {
      const filepath = path.join(customComponentsDir, `${comp.name}.tsx`);
      fs.writeFileSync(filepath, comp.code, 'utf-8');
    }
  }

  res.json({ ok: true });
});

export default router;
