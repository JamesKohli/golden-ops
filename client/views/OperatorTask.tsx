import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import type { TaskWithDetails, TemplateStep } from '../../shared/types.js';
import { buildStepContext, parseInputType, resolvePrefill } from '../../shared/engine.js';
import StepRenderer from '../components/StepRenderer';
import WebPanel from '../components/WebPanel';
import type { BoxData } from '../components/EvidenceCapture';

/** Group steps into screens by their `group` field. Steps without a group get their own screen. */
function groupSteps(steps: TemplateStep[]): TemplateStep[][] {
  const screens: TemplateStep[][] = [];
  let currentGroup: string | null = null;
  let currentScreen: TemplateStep[] = [];

  for (const step of steps) {
    if (step.group) {
      if (step.group === currentGroup) {
        currentScreen.push(step);
      } else {
        if (currentScreen.length) screens.push(currentScreen);
        currentGroup = step.group;
        currentScreen = [step];
      }
    } else {
      if (currentScreen.length) screens.push(currentScreen);
      currentGroup = null;
      currentScreen = [];
      screens.push([step]);
    }
  }
  if (currentScreen.length) screens.push(currentScreen);
  return screens;
}

export default function OperatorTask() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [task, setTask] = useState<TaskWithDetails | null>(null);
  const [currentScreen, setCurrentScreen] = useState(0);
  const [responses, setResponses] = useState<Record<string, any>>({});
  const [evidence, setEvidence] = useState<Record<string, string>>({});
  const [boxes, setBoxes] = useState<Record<string, BoxData>>({});
  const [drawModeStepId, setDrawModeStepId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/tasks/${id}`)
      .then((r) => r.json())
      .then((data) => {
        setTask(data);
        const initialResponses: Record<string, any> = { ...(data.responses || {}) };
        if (data.template?.steps && data.input) {
          const ctx = { input: data.input, ...initialResponses };
          for (const s of data.template.steps) {
            if (s.prefill_from && initialResponses[s.id] === undefined) {
              const prefilled = resolvePrefill(s.prefill_from, ctx);
              if (prefilled !== undefined && prefilled !== null && prefilled !== '') {
                initialResponses[s.id] = prefilled;
              }
            }
          }
        }
        setResponses(initialResponses);
        setLoading(false);
      })
      .catch(() => {
        setError('Failed to load task');
        setLoading(false);
      });
  }, [id]);

  const allSteps = task?.template.steps ?? [];
  const screens = useMemo(() => groupSteps(allSteps), [allSteps]);
  const screenSteps = screens[currentScreen] ?? [];
  const totalScreens = screens.length;

  const context = buildStepContext(
    Object.fromEntries(
      allSteps.map((s) => [s.output_key, responses[s.id]])
        .filter(([, v]) => v !== undefined)
    ),
    task?.input ?? {}
  );

  const saveSteps = useCallback(async (steps: TemplateStep[]) => {
    if (!task) return;
    for (const step of steps) {
      const value = responses[step.id];
      if (value !== undefined && value !== null && value !== '') {
        try {
          await fetch(`/api/tasks/${task.id}/steps/${step.id}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ value }),
          });
        } catch (e) {
          console.error('Failed to save step', e);
        }
      }
    }
  }, [task, responses]);

  const validateScreen = (): string | null => {
    for (const step of screenSteps) {
      if (step.required === false) continue;
      const value = responses[step.id];
      if (value === undefined || value === null || value === '') {
        return `"${step.output_key.replace(/_/g, ' ')}" is required`;
      }
      if (Array.isArray(value) && value.every((v: string) => !v.trim())) {
        return `Please add at least one item for "${step.output_key.replace(/_/g, ' ')}"`;
      }
    }
    return null;
  };

  const handleNext = async () => {
    const err = validateScreen();
    if (err) { setError(err); return; }
    setError(null);
    await saveSteps(screenSteps);
    if (currentScreen < totalScreens - 1) {
      setCurrentScreen(currentScreen + 1);
    }
  };

  const handleBack = () => {
    if (currentScreen > 0) {
      setError(null);
      setCurrentScreen(currentScreen - 1);
    }
  };

  const handleComplete = async () => {
    if (!task) return;
    const err = validateScreen();
    if (err) { setError(err); return; }
    setSubmitting(true);
    setError(null);
    await saveSteps(screenSteps);
    try {
      const res = await fetch(`/api/tasks/${task.id}/complete`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to complete task');
        setSubmitting(false);
        return;
      }
      navigate('/?completed=true');
    } catch {
      setError('Failed to complete task');
      setSubmitting(false);
    }
  };

  const handleFlag = async () => {
    if (!task) return;
    const reason = prompt('Why are you flagging this task?');
    if (!reason) return;
    await fetch(`/api/tasks/${task.id}/flag`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason }),
    });
    navigate('/');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
      </div>
    );
  }

  if (!task || screenSteps.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500 mb-4">Task not found</p>
          <Link to="/" className="text-indigo-600 hover:underline">Back to queue</Link>
        </div>
      </div>
    );
  }

  const isLastScreen = currentScreen === totalScreens - 1;
  const isScreenValid = validateScreen() === null;

  // Compute completed steps count for progress
  const stepsBeforeThisScreen = screens.slice(0, currentScreen).reduce((n, s) => n + s.length, 0);
  const stepsIncludingThisScreen = stepsBeforeThisScreen + screenSteps.length;
  const progressPct = (stepsIncludingThisScreen / allSteps.length) * 100;

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Top Bar */}
      <header className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          <Link to="/" className="text-gray-400 hover:text-gray-600 transition-colors" title="Back to dashboard">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </Link>
          <div>
            <h1 className="text-sm font-semibold text-gray-900">
              {task.input?.business_name || task.template.name.replace(/_/g, ' ')}
            </h1>
            <p className="text-xs text-gray-500">
              {task.input?.address || `Task ${task.id.slice(0, 8)}`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={handleFlag}
            className="text-xs text-gray-400 hover:text-orange-500 transition-colors flex items-center gap-1"
            title="Flag this task as problematic"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" />
            </svg>
            Flag issue
          </button>
          <div className="text-sm text-gray-500">
            <span className="font-semibold text-gray-900">{currentScreen + 1}</span>
            <span> / {totalScreens}</span>
          </div>
        </div>
      </header>

      {/* Progress Bar */}
      <div className="h-1 bg-gray-100 shrink-0">
        <div
          className="h-full bg-indigo-600 transition-all duration-300"
          style={{ width: `${progressPct}%` }}
        />
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel - Web Views */}
        <div className="w-[60%] p-4">
          <WebPanel
            panels={task.template.panels.left}
            dataSources={task.template.data_sources}
            context={context}
            drawMode={!!drawModeStepId}
            onBoxDrawn={(box) => {
              if (drawModeStepId) setBoxes({ ...boxes, [drawModeStepId]: box });
              setDrawModeStepId(null);
            }}
            onCancelDraw={() => setDrawModeStepId(null)}
            boxes={screenSteps.map(s => boxes[s.id]).filter(Boolean)}
          />
        </div>

        {/* Right Panel - Step Flow */}
        <div className="w-[40%] border-l border-gray-200 bg-white flex flex-col">
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {screenSteps.map((step, idx) => (
              <div key={step.id}>
                {idx > 0 && <hr className="border-gray-100 mb-6" />}

                {/* Step Header */}
                <div className="mb-3 flex items-center gap-2">
                  <span className="inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold bg-indigo-600 text-white">
                    {stepsBeforeThisScreen + idx + 1}
                  </span>
                  <span className="text-sm font-medium text-gray-500">
                    {step.output_key.replace(/_/g, ' ')}
                  </span>
                  {step.required === false && (
                    <span className="text-xs text-gray-400 italic">optional</span>
                  )}
                </div>

                <StepRenderer
                  step={step}
                  value={responses[step.id]}
                  onChange={(val) => setResponses({ ...responses, [step.id]: val })}
                  context={context}
                  taskId={task.id}
                  evidencePath={evidence[step.id] || null}
                  onEvidenceUploaded={(path) => setEvidence({ ...evidence, [step.id]: path })}
                  onStartBoxDraw={() => setDrawModeStepId(step.id)}
                  boxData={boxes[step.id] || null}
                />
              </div>
            ))}

            {/* Error */}
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                {error}
              </div>
            )}
          </div>

          {/* Navigation */}
          <div className="border-t border-gray-200 px-6 py-4 flex items-center justify-between shrink-0">
            <button
              onClick={handleBack}
              disabled={currentScreen === 0}
              className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              Back
            </button>
            <div className="flex gap-2">
              {isLastScreen ? (
                <button
                  onClick={handleComplete}
                  disabled={submitting}
                  className="px-6 py-2.5 bg-green-600 text-white text-sm font-semibold rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
                >
                  {submitting ? 'Submitting...' : 'Complete Task'}
                </button>
              ) : (
                <button
                  onClick={handleNext}
                  className="px-6 py-2.5 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
                >
                  Next
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
