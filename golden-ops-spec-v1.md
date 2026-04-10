# Golden Dataset Operations Tool — Spec V1

## Overview

A configurable operations tool for creating golden datasets to eval/hillclimb AI agents that edit map data. Operators are walked through step-by-step workflows with embedded web views (Google Maps page, business website) and produce structured golden records. Workflows are defined in YAML and can be customized on-the-fly via a vibe-coding interface backed by Claude API.

## Stack

- **Frontend:** React + TypeScript, Vite
- **Backend:** Node.js (Express or Fastify)
- **DB:** SQLite (single file, demo-grade)
- **Evidence storage:** Local filesystem (`./evidence/{task_id}/`)
- **Custom component library:** Git repo (`./custom-components/`)
- **LLM integration:** Claude API (Sonnet) for vibe code editor

---

## 1. Data Source Layer

No API keys. All data sources are web embeds rendered as iframes in the operator UI.

```yaml
data_sources:
  - id: maps_view
    type: web_embed
    url_template: "https://www.google.com/maps/place/?q=place_id:{{input.place_id}}"

  - id: biz_website
    type: web_embed
    url_template: "{{website_url}}"
```

- Operator can interact with iframes (scroll, click through Maps page to find website, etc.)
- When an operator enters a value at a step that's referenced by a `url_template` (e.g., `website_url` feeding the `biz_website` iframe), the panel reloads automatically.

**Batch input** is a CSV. Minimum column: `place_id`. Optional columns become available as `{{input.column}}` in templates.

---

## 2. Template Format

Templates are YAML files defining a linear sequence of operator steps, data sources, UI panel layout, QA config, and output schema.

### Example: `verify_phone_from_website.yaml`

```yaml
name: verify_phone_from_website
version: 1
description: Verify a business's phone number against its website

data_sources:
  - id: maps_view
    type: web_embed
    url_template: "https://www.google.com/maps/place/?q=place_id:{{input.place_id}}"
  - id: biz_website
    type: web_embed
    url_template: "{{website_url}}"

panels:
  left:
    - source: maps_view
      label: "Google Maps"
    - source: biz_website
      label: "Business Website"
  right: steps

steps:
  - id: website_url
    instruction: "Find the business website from the Maps listing. Paste it below."
    input_type: url
    output_key: website_url

  - id: website_status
    instruction: "Can you access the business website?"
    input_type: enum [accessible, down, not_a_website, no_website_listed]
    output_key: website_status

  - id: listed_phone
    instruction: "What phone number is shown on the Google Maps listing?"
    input_type: phone
    output_key: listed_phone

  - id: phones_found
    instruction: "List every phone number visible on the business website."
    input_type: string[]
    output_key: phones_found
    evidence: screenshot

  - id: match_assessment
    instruction: >
      Maps phone: {{listed_phone}}
      Website phones: {{phones_found}}
      Do they match?
    input_type: enum [exact_match, format_differs_same_number, different_number, no_phone_on_site]
    output_key: match_status

  - id: recommended_phone
    instruction: "What should the canonical phone number be?"
    input_type: phone
    prefill_from: phones_found[0]
    output_key: recommended_phone

  - id: confidence
    input_type: enum [high, medium, low]
    output_key: confidence

  - id: notes
    input_type: text
    required: false
    output_key: notes

qa:
  dual_rate_percentage: 20
  agreement_metric: exact
  disagreement_routing: reviewer
  calibration_tasks: 5

output_schema:
  place_id: "{{input.place_id}}"
  source_url: "{{website_url}}"
  listed_phone: "{{listed_phone}}"
  match_status: "{{match_status}}"
  recommended_phone: "{{recommended_phone}}"
  confidence: "{{confidence}}"
  notes: "{{notes}}"
```

### Template features

- **Variable interpolation:** `{{var}}` references any `output_key` from a prior step or `{{input.column}}` from batch CSV.
- **`input_type`:** Determines which widget renders. Built-in types: `enum`, `string[]`, `phone`, `url`, `text`. Custom types use `custom:component_name` prefix, resolved from `./custom-components/`.
- **`evidence`:** If set to `screenshot`, the step requires the operator to attach a screenshot before proceeding.
- **`prefill_from`:** Pre-populates the input from a prior step's value. Supports array indexing (`phones_found[0]`).
- **`required`:** Defaults to `true`. Set to `false` to allow skipping.
- **Steps are strictly linear.** No conditional branching in V1.

---

## 3. Operator UI

### Layout

```
┌─────────────────────────────────┬──────────────────────────┐
│  [Google Maps] [Biz Website]   │  Task: verify_phone #47  │
│  ┌───────────────────────────┐ │                          │
│  │                           │ │  Step 3 of 8             │
│  │   <iframe>                │ │  ─────────────────────── │
│  │   Active tab content      │ │  What phone number is    │
│  │                           │ │  shown on the Maps       │
│  │                           │ │  listing?                │
│  │                           │ │                          │
│  │                           │ │  [ +1 212-555-0100    ]  │
│  │                           │ │                          │
│  │                           │ │  [📷 Screenshot]         │
│  │                           │ │                          │
│  └───────────────────────────┘ │  [Back]  [Next →]        │
└─────────────────────────────────┴──────────────────────────┘
```

- Left panel: tabbed iframes defined by `panels.left`. Tabs labeled per `label` field.
- Right panel: step-by-step task flow. Shows instruction, renders appropriate input widget, back/next navigation.
- Next button disabled until required fields + evidence are provided.
- Progress indicator (step N of M) at top.

### Input widget mapping

| `input_type` | Widget |
|---|---|
| `enum [a, b, c]` | Radio button group |
| `string[]` | Repeatable text input (add/remove rows) |
| `phone` | Phone input with basic formatting validation |
| `url` | URL input with validation |
| `text` | Textarea |
| `custom:name` | Dynamically loaded from `./custom-components/name.tsx` |

### Evidence capture

- Screenshot button captures the current left panel iframe content (or accepts file upload as fallback)
- Evidence files saved to `./evidence/{task_id}/{step_id}_screenshot.png`
- Evidence paths are automatically bundled into the golden export

---

## 4. Vibe Code Editor

Located in the admin Workflow Designer view. A chat-style text input below a live template preview.

### Flow

1. Admin types natural language request (e.g., "Add a step after match_assessment where the operator can drag-pin a location on a mini-map to confirm the business address")
2. System sends to Claude API:
   - Current YAML template
   - Index of existing custom components
   - The admin's request
3. Claude returns:
   - Updated YAML (or diff)
   - Any new React component code (if a new `input_type` is needed)
4. Admin sees:
   - YAML diff view
   - Live sandbox preview of the new/changed step
5. On approve:
   - YAML template saved to DB (new version)
   - New component written to `./custom-components/{component_name}.tsx`
   - Git commit auto-created

### Custom component contract

All custom components must implement this interface:

```typescript
interface StepInputProps<T> {
  value: T;
  onChange: (val: T) => void;
  context: Record<string, any>; // all resolved template variables
  evidence: {
    attachScreenshot: (dataUrl: string) => void;
    attachNote: (text: string) => void;
  };
}

// Component must be a default export
// File: ./custom-components/{name}.tsx
// Referenced in YAML as: input_type: custom:{name}
```

- Components are sandboxed: no network access, no access to other tasks
- Components are org-scoped and reusable across templates

---

## 5. Task Queue & Assignment

### Batch import

1. Admin uploads CSV (minimum column: `place_id`)
2. System creates one task per row, linked to the selected template
3. Tasks enter `unassigned` status

### Task lifecycle

```
unassigned → assigned → in_progress → completed
                                    → flagged (operator marks as problematic)
```

### Assignment

- Simple: operator clicks "Get next task" from the queue
- Admin can also manually assign tasks to specific operators
- Tasks in QA get assigned to a second operator automatically (per `dual_rate_percentage`)

---

## 6. QA Layer

Configured per-template in the `qa` block:

```yaml
qa:
  dual_rate_percentage: 20    # % of tasks that get two independent operators
  agreement_metric: exact     # comparison method for agreement check
  disagreement_routing: reviewer  # disagreements go to a reviewer queue
  calibration_tasks: 5        # new operators get 5 pre-answered tasks first
```

- Dual-rated tasks: two operators complete independently, system checks agreement
- Disagreements route to a reviewer UI where the reviewer sees both responses side-by-side and picks/edits the final answer
- Per-operator accuracy tracked against agreed/reviewed goldens
- Calibration: new operators first complete N tasks with known answers; must meet threshold before entering the live pool

---

## 7. Eval Harness

### Golden export format

JSONL file. One line per completed task:

```json
{
  "eval_id": "a1b2c3",
  "workflow": "verify_phone_from_website",
  "workflow_version": 1,
  "input": {
    "place_id": "ChIJN1t_tDeuEmsRUsoyG83frY4"
  },
  "golden": {
    "source_url": "https://examplecafe.com",
    "listed_phone": "+12125550100",
    "match_status": "exact_match",
    "recommended_phone": "+12125550100",
    "confidence": "high",
    "notes": null
  },
  "metadata": {
    "operator_id": "op_abc",
    "completed_at": "2026-04-10T14:30:00Z",
    "duration_seconds": 94,
    "qa_status": "agreed",
    "evidence": ["evidence/task_47/phones_found_screenshot.png"]
  }
}
```

### Eval runner

```
Usage: npx ts-node eval/eval_runner.ts --goldens goldens.jsonl --agent phone_verify_agent

For each golden:
  1. Pass `input` to the agent
  2. Agent returns output matching the `golden` schema
  3. Score per-field using configured scorers
  4. Aggregate metrics
```

### Scorer config (per-workflow)

```yaml
scoring:
  match_status:
    type: exact          # 0 or 1
  recommended_phone:
    type: phone_normalized  # strip formatting, compare digit sequences
  confidence:
    type: skip           # informational, not scored
```

### Output metrics

- Overall accuracy (% of goldens where all scored fields match)
- Per-field accuracy
- Confusion matrix for enum fields (e.g., match_status)
- Breakdown by confidence level (are high-confidence goldens easier?)

---

## 8. Data Model (SQLite)

```sql
CREATE TABLE templates (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  version INTEGER NOT NULL,
  yaml_content TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE batches (
  id TEXT PRIMARY KEY,
  template_id TEXT NOT NULL REFERENCES templates(id),
  source_file TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL
);

CREATE TABLE tasks (
  id TEXT PRIMARY KEY,
  batch_id TEXT NOT NULL REFERENCES batches(id),
  input_json TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'unassigned',
  assigned_to TEXT REFERENCES operators(id),
  started_at TEXT,
  completed_at TEXT
);

CREATE TABLE step_responses (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES tasks(id),
  step_id TEXT NOT NULL,
  value_json TEXT NOT NULL,
  evidence_path TEXT,
  timestamp TEXT NOT NULL
);

CREATE TABLE operators (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  accuracy_score REAL,
  tasks_completed INTEGER DEFAULT 0
);

CREATE TABLE qa_pairs (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES tasks(id),
  operator_1 TEXT NOT NULL REFERENCES operators(id),
  operator_2 TEXT REFERENCES operators(id),
  agreed INTEGER,
  reviewer_id TEXT REFERENCES operators(id),
  resolved_value_json TEXT
);
```

---

## 9. Repo Structure

```
golden-ops/
├── server/
│   ├── index.ts                # Express/Fastify app entry
│   ├── routes/
│   │   ├── templates.ts        # CRUD for workflow templates
│   │   ├── batches.ts          # Upload CSV, create tasks
│   │   ├── tasks.ts            # Assignment, step submission, flagging
│   │   ├── operators.ts        # Operator management, metrics
│   │   ├── qa.ts               # QA pair management, reviewer actions
│   │   ├── export.ts           # Golden JSONL export
│   │   └── vibe.ts             # Claude API proxy for vibe editor
│   ├── db.ts                   # SQLite setup + migrations
│   └── engine.ts               # Template parser, variable interpolation, step sequencing
├── client/
│   ├── App.tsx
│   ├── views/
│   │   ├── Designer.tsx        # Template editor + vibe code chat input
│   │   ├── OperatorTask.tsx    # Main operator workflow UI (split pane)
│   │   ├── TaskQueue.tsx       # Admin task list, assignment, batch management
│   │   └── QAReview.tsx        # Side-by-side disagreement reviewer UI
│   ├── components/
│   │   ├── StepRenderer.tsx    # Routes input_type → widget component
│   │   ├── WebPanel.tsx        # Tabbed iframe manager (load, reload on var change)
│   │   ├── EvidenceCapture.tsx # Screenshot + file upload
│   │   ├── YamlDiffView.tsx    # Diff display for vibe editor approvals
│   │   └── inputs/             # Built-in input widgets
│   │       ├── EnumInput.tsx
│   │       ├── PhoneInput.tsx
│   │       ├── StringListInput.tsx
│   │       ├── UrlInput.tsx
│   │       └── TextInput.tsx
├── custom-components/          # Git-tracked vibe-coded custom step components
│   └── README.md
├── templates/                  # YAML workflow templates
│   └── verify_phone_from_website.yaml
├── eval/
│   ├── eval_runner.ts          # CLI eval runner
│   └── scorers/
│       ├── exact.ts
│       └── phone_normalized.ts
├── evidence/                   # Local evidence file storage
├── golden-ops.db               # SQLite database (gitignored)
├── package.json
├── tsconfig.json
└── vite.config.ts
```

---

## 10. Build Order

Implement in this order. Each phase should be functional and testable before moving to the next.

### Phase 1: Template Engine + DB
- YAML parser for template format
- Variable interpolation engine (`{{var}}` resolution)
- Step sequencing logic
- SQLite schema setup + migrations
- Template CRUD API routes

### Phase 2: Task Queue
- CSV batch import (parse CSV, create tasks)
- Task CRUD + status management
- Simple assignment (operator claims next task)
- Admin task list view

### Phase 3: Operator UI
- Split pane layout (left: iframe panels, right: step flow)
- Tabbed iframe manager with auto-reload on variable change
- StepRenderer routing input_type to built-in widgets
- All built-in input widgets (enum, phone, string[], url, text)
- Back/next navigation with validation
- Progress indicator

### Phase 4: Evidence Capture
- Screenshot button (capture iframe or file upload)
- Local filesystem storage
- Evidence path tracking in step_responses

### Phase 5: Export + Eval
- JSONL golden exporter
- Eval runner CLI
- Exact and phone_normalized scorers
- Aggregate metrics output

### Phase 6: Vibe Code Editor
- Claude API integration (send template + request, receive YAML + component code)
- YAML diff view for admin approval
- Sandbox preview of new/changed steps
- Write component to `./custom-components/`, auto git commit
- Dynamic component loading in StepRenderer for `custom:` types

### Phase 7: QA Layer
- Dual-rate task creation (clone task for second operator)
- Agreement checking
- Reviewer UI (side-by-side comparison, pick/edit final answer)
- Per-operator accuracy tracking
- Calibration task flow for new operators
