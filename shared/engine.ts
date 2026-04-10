import yaml from 'js-yaml';
import type { TemplateDefinition, ParsedInputType } from './types.js';

/**
 * Parse a YAML string into a TemplateDefinition.
 */
export function parseTemplate(yamlString: string): TemplateDefinition {
  const raw = yaml.load(yamlString) as any;
  if (!raw || typeof raw !== 'object') {
    throw new Error('Invalid template: not a YAML object');
  }
  if (!raw.name) throw new Error('Template missing required field: name');
  if (!raw.steps || !Array.isArray(raw.steps)) throw new Error('Template missing required field: steps');
  if (!raw.data_sources) throw new Error('Template missing required field: data_sources');
  if (!raw.panels) throw new Error('Template missing required field: panels');
  if (!raw.output_schema) throw new Error('Template missing required field: output_schema');

  return {
    name: raw.name,
    version: raw.version ?? 1,
    description: raw.description,
    data_sources: raw.data_sources,
    panels: raw.panels,
    steps: raw.steps.map((s: any) => ({
      id: s.id,
      instruction: s.instruction,
      input_type: s.input_type,
      output_key: s.output_key,
      evidence: s.evidence,
      prefill_from: s.prefill_from,
      required: s.required !== false, // default true
    })),
    qa: raw.qa,
    output_schema: raw.output_schema,
  };
}

/**
 * Resolve {{var}} placeholders in a template string.
 * Supports dot notation (input.place_id) and simple keys (website_url).
 */
export function resolveVariable(template: string, context: Record<string, any>, envVars?: Record<string, string>): string {
  const isUrl = template.includes('://');
  let result = template.replace(/\{\{([\w.\[\]]+)\}\}/g, (_match, path: string) => {
    const value = resolvePath(context, path);
    if (value === undefined || value === null) return '';
    const str = Array.isArray(value) ? value.join(', ') : String(value);
    return isUrl ? encodeURIComponent(str) : str;
  });
  // Replace env var placeholders like GOOGLE_MAPS_API_KEY
  if (envVars) {
    for (const [key, val] of Object.entries(envVars)) {
      result = result.replaceAll(key, val);
    }
  }
  return result;
}

/**
 * Resolve a dot-separated path against a context object.
 * Handles: "input.place_id", "website_url", "phones_found[0]"
 */
function resolvePath(context: Record<string, any>, path: string): any {
  const parts = path.split('.');
  let current: any = context;

  for (const part of parts) {
    if (current === undefined || current === null) return undefined;

    // Handle array indexing: phones_found[0]
    const arrayMatch = part.match(/^(\w+)\[(\d+)\]$/);
    if (arrayMatch) {
      const [, key, indexStr] = arrayMatch;
      current = current[key];
      if (Array.isArray(current)) {
        current = current[parseInt(indexStr, 10)];
      } else {
        return undefined;
      }
    } else {
      current = current[part];
    }
  }

  return current;
}

/**
 * Resolve a prefill_from reference against the current context.
 * Supports array indexing: "phones_found[0]"
 */
export function resolvePrefill(prefillFrom: string, context: Record<string, any>): any {
  return resolvePath(context, prefillFrom);
}

/**
 * Build the step context from collected responses and the CSV input row.
 */
export function buildStepContext(
  responses: Record<string, any>,
  inputRow: Record<string, any>
): Record<string, any> {
  return {
    input: inputRow,
    ...responses,
  };
}

/**
 * Parse an input_type string into a structured ParsedInputType.
 *
 * Examples:
 *   "enum [a, b, c]" → { kind: 'enum', options: ['a', 'b', 'c'] }
 *   "string[]"       → { kind: 'string_list' }
 *   "phone"          → { kind: 'phone' }
 *   "custom:map_pin" → { kind: 'custom', name: 'map_pin' }
 */
export function parseInputType(raw: string): ParsedInputType {
  const trimmed = raw.trim();

  // enum [a, b, c]
  if (trimmed.startsWith('enum')) {
    const bracketMatch = trimmed.match(/enum\s*\[([^\]]+)\]/);
    if (bracketMatch) {
      const options = bracketMatch[1].split(',').map(o => o.trim());
      return { kind: 'enum', options };
    }
    // enum without brackets — treat as text fallback
    return { kind: 'text' };
  }

  if (trimmed === 'string[]') return { kind: 'string_list' };
  if (trimmed === 'phone') return { kind: 'phone' };
  if (trimmed === 'url') return { kind: 'url' };
  if (trimmed === 'text') return { kind: 'text' };

  // custom:component_name
  if (trimmed.startsWith('custom:')) {
    return { kind: 'custom', name: trimmed.slice(7) };
  }

  // Default fallback
  return { kind: 'text' };
}
