// ── Template Definition Types ──

export interface DataSource {
  id: string;
  type: 'web_embed';
  url_template: string;
}

export interface PanelSourceRef {
  source: string;
  label: string;
}

export interface PanelConfig {
  left: PanelSourceRef[];
  right: 'steps';
}

export interface TemplateStep {
  id: string;
  instruction?: string;
  input_type: string;
  output_key: string;
  evidence?: 'screenshot';
  prefill_from?: string;
  required?: boolean; // defaults to true
  group?: string;
}

export interface QAConfig {
  dual_rate_percentage: number;
  agreement_metric: string;
  disagreement_routing: string;
  calibration_tasks: number;
}

export interface TemplateDefinition {
  name: string;
  version: number;
  description?: string;
  data_sources: DataSource[];
  panels: PanelConfig;
  steps: TemplateStep[];
  qa?: QAConfig;
  output_schema: Record<string, string>;
}

// ── Parsed Input Types (discriminated union) ──

export type ParsedInputType =
  | { kind: 'enum'; options: string[] }
  | { kind: 'string_list' }
  | { kind: 'phone' }
  | { kind: 'url' }
  | { kind: 'text' }
  | { kind: 'custom'; name: string };

// ── Custom Component Contract ──

export interface StepInputProps<T = any> {
  value: T;
  onChange: (val: T) => void;
  context: Record<string, any>;
  evidence: {
    attachScreenshot: (dataUrl: string) => void;
    attachNote: (text: string) => void;
  };
}

// ── DB Row Types ──

export interface TemplateRow {
  id: string;
  name: string;
  version: number;
  yaml_content: string;
  created_at: string;
  updated_at: string;
}

export interface BatchRow {
  id: string;
  template_id: string;
  source_file: string;
  status: string;
  created_at: string;
}

export interface TaskRow {
  id: string;
  batch_id: string;
  input_json: string;
  status: string;
  assigned_to: string | null;
  started_at: string | null;
  completed_at: string | null;
  flag_reason: string | null;
}

export interface StepResponseRow {
  id: string;
  task_id: string;
  step_id: string;
  value_json: string;
  evidence_path: string | null;
  timestamp: string;
}

export interface OperatorRow {
  id: string;
  name: string;
  email: string;
  accuracy_score: number | null;
  tasks_completed: number;
}

// ── API Response Types ──

export interface TaskWithDetails extends TaskRow {
  template: TemplateDefinition;
  template_id: string;
  responses: Record<string, any>;
  input: Record<string, any>;
}

export interface BatchWithStats extends BatchRow {
  total_tasks: number;
  completed_tasks: number;
  in_progress_tasks: number;
  template_name: string;
}
