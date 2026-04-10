import { parseInputType, resolveVariable, resolvePrefill } from '../../shared/engine.js';
import type { TemplateStep } from '../../shared/types.js';
import EnumInput from './inputs/EnumInput';
import PhoneInput from './inputs/PhoneInput';
import UrlInput from './inputs/UrlInput';
import TextInput from './inputs/TextInput';
import StringListInput from './inputs/StringListInput';
import EvidenceCapture from './EvidenceCapture';
import type { BoxData } from './EvidenceCapture';
import { useEffect } from 'react';

interface StepRendererProps {
  step: TemplateStep;
  value: any;
  onChange: (val: any) => void;
  context: Record<string, any>;
  taskId: string;
  evidencePath: string | null;
  onEvidenceUploaded: (path: string) => void;
  onStartBoxDraw: () => void;
  boxData: BoxData | null;
}

export default function StepRenderer({
  step,
  value,
  onChange,
  context,
  taskId,
  evidencePath,
  onEvidenceUploaded,
  onStartBoxDraw,
  boxData,
}: StepRendererProps) {
  const parsed = parseInputType(step.input_type);
  const instruction = step.instruction ? resolveVariable(step.instruction, context) : '';

  // Handle prefill on mount
  useEffect(() => {
    if (step.prefill_from && (value === undefined || value === null || value === '')) {
      const prefilled = resolvePrefill(step.prefill_from, context);
      if (prefilled !== undefined && prefilled !== null) {
        onChange(prefilled);
      }
    }
  }, [step.id]);

  return (
    <div className="space-y-4">
      {instruction && (
        <p className="text-gray-700 text-sm leading-relaxed whitespace-pre-wrap">{instruction}</p>
      )}

      <div>
        {parsed.kind === 'enum' && (
          <EnumInput options={parsed.options} value={value ?? null} onChange={onChange} />
        )}
        {parsed.kind === 'phone' && (
          <PhoneInput value={value ?? ''} onChange={onChange} />
        )}
        {parsed.kind === 'url' && (
          <UrlInput value={value ?? ''} onChange={onChange} />
        )}
        {parsed.kind === 'text' && (
          <TextInput value={value ?? ''} onChange={onChange} />
        )}
        {parsed.kind === 'string_list' && (
          <StringListInput value={value ?? ['']} onChange={onChange} />
        )}
        {parsed.kind === 'custom' && (
          <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-700">
            Custom component: {parsed.name} (not yet loaded)
          </div>
        )}
      </div>

      {step.evidence === 'screenshot' && (
        <EvidenceCapture
          taskId={taskId}
          stepId={step.id}
          currentPath={evidencePath}
          onUploaded={onEvidenceUploaded}
          onStartBoxDraw={onStartBoxDraw}
          boxData={boxData}
        />
      )}
    </div>
  );
}
