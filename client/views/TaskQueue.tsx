import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import type { BatchWithStats, TemplateRow, TaskRow } from '../../shared/types.js';

function WelcomeModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-xl max-w-lg w-full overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-indigo-600 px-6 py-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h2 className="text-lg font-bold text-white">Welcome to James's Golden Ops Demo</h2>
          </div>
          <p className="text-indigo-100 text-sm leading-relaxed">
            A configurable tool for building golden evaluation datasets. Human operators verify business data against live web sources, producing structured records to benchmark AI agents.
          </p>
        </div>

        {/* Things to try */}
        <div className="px-6 py-5">
          <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-3">Things to try</h3>
          <div className="space-y-3">
            {[
              {
                icon: (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                ),
                color: 'bg-indigo-100 text-indigo-600',
                title: 'Walk through a task',
                desc: 'Click "Get Next Task" to verify a Brooklyn restaurant\'s phone number — you\'ll see Google Maps and the business website side by side.',
              },
              {
                icon: (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                ),
                color: 'bg-amber-100 text-amber-600',
                title: 'Draw evidence boxes',
                desc: 'On the "phones found" step, click "Draw box on web panel" to highlight where you found a phone number on the website.',
              },
              {
                icon: (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                ),
                color: 'bg-purple-100 text-purple-600',
                title: 'Modify the workflow with AI',
                desc: 'Open the Workflow Designer and ask Claude to add or change steps — e.g., "Add a step asking if the business appears permanently closed."',
              },
              {
                icon: (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                ),
                color: 'bg-emerald-100 text-emerald-600',
                title: 'Export golden records',
                desc: 'Complete a task, then click "Export JSONL" on the batch card to download structured evaluation data.',
              },
            ].map((item, i) => (
              <div key={i} className="flex gap-3">
                <div className={`w-8 h-8 rounded-lg ${item.color} flex items-center justify-center shrink-0`}>
                  {item.icon}
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">{item.title}</p>
                  <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 pb-5">
          <button
            onClick={onClose}
            className="w-full py-3 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 transition-colors shadow-sm"
          >
            Get Started
          </button>
        </div>
      </div>
    </div>
  );
}

interface TaskListItem extends TaskRow {
  input: Record<string, any>;
}

export default function TaskQueue() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [batches, setBatches] = useState<BatchWithStats[]>([]);
  const [templates, setTemplates] = useState<Pick<TemplateRow, 'id' | 'name' | 'version'>[]>([]);
  const [myTasks, setMyTasks] = useState<TaskListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [showWelcome, setShowWelcome] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [uploadTemplateId, setUploadTemplateId] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const justCompleted = searchParams.get('completed') === 'true';

  const fetchData = () => {
    Promise.all([
      fetch('/api/batches').then((r) => r.json()),
      fetch('/api/templates').then((r) => r.json()),
      fetch('/api/tasks?assigned_to=op_demo&limit=50').then((r) => r.json()),
    ]).then(([b, t, tasks]) => {
      setBatches(b);
      setTemplates(t);
      setMyTasks(
        (tasks as TaskRow[])
          .map((tk) => ({ ...tk, input: JSON.parse(tk.input_json) }))
          .sort((a, b) => {
            const order: Record<string, number> = { in_progress: 0, assigned: 1, completed: 2, flagged: 3 };
            return (order[a.status] ?? 9) - (order[b.status] ?? 9);
          })
      );
      if (!uploadTemplateId && t.length > 0) setUploadTemplateId(t[0].id);
      setLoading(false);
    });
  };

  useEffect(() => { fetchData(); }, []);

  // Show welcome modal on first visit
  useEffect(() => {
    if (!loading && !justCompleted) {
      const dismissed = sessionStorage.getItem('welcome_dismissed');
      if (!dismissed) setShowWelcome(true);
    }
  }, [loading]);

  const handleClaim = async () => {
    setClaiming(true);
    try {
      const res = await fetch('/api/tasks/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ operator_id: 'op_demo' }),
      });
      if (!res.ok) {
        alert('No tasks available');
        setClaiming(false);
        return;
      }
      const data = await res.json();
      navigate(`/task/${data.id}`);
    } catch {
      alert('Failed to claim task');
      setClaiming(false);
    }
  };

  const handleUpload = async () => {
    const file = fileRef.current?.files?.[0];
    if (!file || !uploadTemplateId) return;
    const form = new FormData();
    form.append('file', file);
    form.append('template_id', uploadTemplateId);
    try {
      const res = await fetch('/api/batches', { method: 'POST', body: form });
      const data = await res.json();
      if (!res.ok) { alert(data.error || 'Upload failed'); return; }
      setShowUpload(false);
      if (fileRef.current) fileRef.current.value = '';
      fetchData();
    } catch { alert('Upload failed'); }
  };

  const handleReset = async () => {
    if (!confirm('Reset the demo? This wipes all progress and reloads the sample data.')) return;
    setResetting(true);
    await fetch('/api/reset', { method: 'POST' });
    sessionStorage.removeItem('welcome_dismissed');
    window.location.href = '/';
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
      </div>
    );
  }

  const totalAvailable = batches.reduce((sum, b) => sum + b.total_tasks - b.completed_tasks - b.in_progress_tasks, 0);

  const statusBadge = (status: string) => {
    const styles: Record<string, string> = {
      in_progress: 'bg-blue-100 text-blue-700',
      assigned: 'bg-yellow-100 text-yellow-700',
      completed: 'bg-green-100 text-green-700',
      flagged: 'bg-orange-100 text-orange-700',
    };
    return (
      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${styles[status] || 'bg-gray-100 text-gray-600'}`}>
        {status.replace('_', ' ')}
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {showWelcome && (
        <WelcomeModal onClose={() => {
          setShowWelcome(false);
          sessionStorage.setItem('welcome_dismissed', '1');
        }} />
      )}

      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-900">Golden Ops</h1>
              <p className="text-xs text-gray-500">Human-in-the-loop golden dataset builder</p>
            </div>
          </div>
          <nav className="flex items-center gap-1">
            <Link
              to="/designer"
              className="px-3 py-1.5 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors flex items-center gap-1.5 shadow-sm"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
              Workflow Designer
            </Link>
            <div className="w-px h-5 bg-gray-200 mx-1" />
            <button
              onClick={handleReset}
              disabled={resetting}
              className="px-3 py-1.5 text-sm text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors font-medium disabled:opacity-50"
            >
              {resetting ? 'Resetting...' : 'Reset Demo'}
            </button>
          </nav>
        </div>
      </header>

      {/* Demo banner */}
      <div className="bg-amber-50 border-b border-amber-200">
        <div className="max-w-6xl mx-auto px-6 py-2 flex items-center gap-2 text-xs text-amber-700">
          <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>This is a shared demo &mdash; all visitors see the same data. If things look off, hit <strong>Reset Demo</strong> to restore a clean state.</span>
        </div>
      </div>

      <main className="max-w-6xl mx-auto px-6 py-8">
        {/* Success Banner */}
        {justCompleted && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-xl flex items-center gap-3">
            <svg className="w-5 h-5 text-green-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <p className="text-sm font-medium text-green-700">Task completed and added to the golden dataset.</p>
          </div>
        )}

        {/* Hero / How it works */}
        {myTasks.length === 0 && (
          <div className="mb-8 p-6 bg-white rounded-xl border border-gray-200 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900 mb-2">How it works</h2>
            <p className="text-sm text-gray-600 leading-relaxed mb-4">
              Golden Ops helps you build high-quality evaluation datasets for AI agents that edit map data.
              Operators walk through structured workflows — verifying business info against live web sources —
              and their responses are exported as scored golden records.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {[
                { num: '1', title: 'Import businesses', desc: 'Upload a CSV of business listings to create a task batch' },
                { num: '2', title: 'Verify data', desc: 'Walk through each business, comparing Maps and website info side-by-side' },
                { num: '3', title: 'Collect evidence', desc: 'Draw highlights and attach screenshots to support each answer' },
                { num: '4', title: 'Export goldens', desc: 'Download structured JSONL to evaluate and benchmark AI agents' },
              ].map((s) => (
                <div key={s.num} className="flex gap-3">
                  <div className="w-7 h-7 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-bold shrink-0">
                    {s.num}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">{s.title}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{s.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Action Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          {/* Claim Task */}
          <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
            <div className="flex items-start justify-between mb-1">
              <h2 className="text-lg font-semibold text-gray-900">Start Next Task</h2>
              <div className="w-10 h-10 rounded-lg bg-indigo-100 flex items-center justify-center">
                <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </div>
            </div>
            <p className="text-sm text-gray-500 mb-4">
              {totalAvailable > 0
                ? `Claim the next unassigned business and walk through the verification workflow. ${totalAvailable} remaining.`
                : 'All tasks have been claimed or completed.'}
            </p>
            <button
              onClick={handleClaim}
              disabled={claiming || totalAvailable === 0}
              className="w-full py-3 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
            >
              {claiming ? 'Loading task...' : 'Get Next Task'}
            </button>
          </div>

          {/* Upload Batch */}
          <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
            <div className="flex items-start justify-between mb-1">
              <h2 className="text-lg font-semibold text-gray-900">Import Businesses</h2>
              <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center">
                <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
              </div>
            </div>
            <p className="text-sm text-gray-500 mb-4">
              Upload a CSV with <code className="text-xs bg-gray-100 px-1 py-0.5 rounded">place_id</code>, <code className="text-xs bg-gray-100 px-1 py-0.5 rounded">business_name</code>, and <code className="text-xs bg-gray-100 px-1 py-0.5 rounded">address</code> columns. Each row becomes a task. Websites and phone numbers are auto-enriched via Google Places.
            </p>
            {!showUpload ? (
              <button
                onClick={() => setShowUpload(true)}
                disabled={templates.length === 0}
                className="w-full py-3 bg-white text-gray-700 font-semibold rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-50 transition-colors"
              >
                Upload CSV
              </button>
            ) : (
              <div className="space-y-3">
                <select
                  value={uploadTemplateId}
                  onChange={(e) => setUploadTemplateId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                >
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>{t.name.replace(/_/g, ' ')} (v{t.version})</option>
                  ))}
                </select>
                <input ref={fileRef} type="file" accept=".csv" className="w-full text-sm text-gray-500 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100" />
                <div className="flex gap-2">
                  <button onClick={handleUpload} className="flex-1 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700 transition-colors">Upload</button>
                  <button onClick={() => setShowUpload(false)} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700 transition-colors">Cancel</button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* My Tasks */}
        {myTasks.length > 0 && (
          <div className="mb-8">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold text-gray-900">My Tasks</h2>
              <p className="text-xs text-gray-400">Click any task to resume or review it</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">Business</th>
                    <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">Address</th>
                    <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">Status</th>
                    <th className="text-right text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {myTasks.map((task) => (
                    <tr key={task.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3">
                        <span className="text-sm font-medium text-gray-900">
                          {task.input.business_name || task.input.place_id || task.id.slice(0, 8)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm text-gray-500">{task.input.address || '—'}</span>
                      </td>
                      <td className="px-4 py-3">{statusBadge(task.status)}</td>
                      <td className="px-4 py-3 text-right">
                        <Link to={`/task/${task.id}`} className="text-sm font-medium text-indigo-600 hover:text-indigo-800 transition-colors">
                          {task.status === 'completed' || task.status === 'flagged' ? 'Review' : 'Continue'}
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Batches */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-gray-900">Batches</h2>
            <p className="text-xs text-gray-400">Each batch is a CSV of businesses linked to a workflow template</p>
          </div>
          {batches.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
              <p className="text-gray-500 text-sm">No batches yet. Upload a CSV above to get started.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {batches.map((batch) => {
                const pct = batch.total_tasks > 0 ? Math.round((batch.completed_tasks / batch.total_tasks) * 100) : 0;
                return (
                  <div key={batch.id} className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <h3 className="font-semibold text-gray-900">{batch.template_name?.replace(/_/g, ' ') || 'Unknown template'}</h3>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {batch.source_file} &middot; {new Date(batch.created_at).toLocaleDateString()} &middot; {batch.total_tasks} tasks
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        {batch.completed_tasks > 0 && (
                          <a
                            href={`/api/export/${batch.id}`}
                            className="px-3 py-1.5 text-xs text-indigo-600 hover:text-indigo-800 font-medium border border-indigo-200 rounded-md hover:bg-indigo-50 transition-colors"
                          >
                            Export JSONL
                          </a>
                        )}
                        <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                          batch.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                        }`}>
                          {batch.status}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-indigo-600 rounded-full transition-all" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-sm font-medium text-gray-600 whitespace-nowrap">
                        {batch.completed_tasks}/{batch.total_tasks} completed
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
