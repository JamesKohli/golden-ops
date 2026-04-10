import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import YamlDiffView from '../components/YamlDiffView';

interface Template {
  id: string;
  name: string;
  version: number;
  yaml_content: string;
}

interface VibeResponse {
  updated_yaml: string;
  explanation: string;
  new_components: { name: string; code: string }[];
  original_yaml: string;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  vibeResponse?: VibeResponse;
  approved?: boolean;
}

export default function Designer() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedId, setSelectedId] = useState<string>('');
  const [currentYaml, setCurrentYaml] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch('/api/templates')
      .then((r) => r.json())
      .then((data) => {
        setTemplates(data);
        if (data.length > 0) {
          setSelectedId(data[0].id);
          loadTemplate(data[0].id);
        }
        setPageLoading(false);
      });
  }, []);

  const loadTemplate = async (id: string) => {
    const res = await fetch(`/api/templates/${id}`);
    const data = await res.json();
    setCurrentYaml(data.yaml_content);
  };

  useEffect(() => {
    if (selectedId) loadTemplate(selectedId);
  }, [selectedId]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSubmit = async () => {
    if (!input.trim() || !selectedId || loading) return;

    const userMsg: ChatMessage = { role: 'user', content: input.trim() };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const res = await fetch('/api/vibe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ template_id: selectedId, request: input.trim() }),
      });

      const data = await res.json();
      if (!res.ok) {
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', content: `Error: ${data.error}` },
        ]);
      } else {
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: data.explanation,
            vibeResponse: data,
          },
        ]);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: 'Failed to connect to server.' },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (msgIndex: number) => {
    const msg = messages[msgIndex];
    if (!msg.vibeResponse) return;

    try {
      const res = await fetch('/api/vibe/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          template_id: selectedId,
          updated_yaml: msg.vibeResponse.updated_yaml,
          new_components: msg.vibeResponse.new_components,
        }),
      });

      if (res.ok) {
        setCurrentYaml(msg.vibeResponse.updated_yaml);
        setMessages((prev) =>
          prev.map((m, i) => (i === msgIndex ? { ...m, approved: true } : m))
        );
      }
    } catch {
      alert('Failed to apply changes');
    }
  };

  if (pageLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          <Link to="/" className="text-gray-400 hover:text-gray-600 transition-colors" title="Back to dashboard">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </Link>
          <div>
            <h1 className="text-lg font-bold text-gray-900">Workflow Designer</h1>
            <p className="text-xs text-gray-500">Edit workflow templates with natural language using Claude</p>
          </div>
        </div>
        <select
          value={selectedId}
          onChange={(e) => setSelectedId(e.target.value)}
          className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
        >
          {templates.map((t) => (
            <option key={t.id} value={t.id}>{t.name} (v{t.version})</option>
          ))}
        </select>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: YAML Preview */}
        <div className="w-1/2 border-r border-gray-200 flex flex-col bg-gray-950">
          <div className="px-4 py-2 bg-gray-900 border-b border-gray-800 flex items-center justify-between">
            <span className="text-xs font-medium text-gray-400">Current Template YAML</span>
            <span className="text-xs text-gray-600">{templates.find(t => t.id === selectedId)?.name}</span>
          </div>
          <div className="flex-1 overflow-auto">
            <pre className="text-xs text-gray-300 p-4 leading-5 font-mono">{currentYaml}</pre>
          </div>
        </div>

        {/* Right: Chat */}
        <div className="w-1/2 flex flex-col bg-gray-50">
          {/* Chat Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.length === 0 && (
              <div className="h-full flex items-center justify-center">
                <div className="text-center max-w-sm">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-indigo-100 flex items-center justify-center">
                    <svg className="w-8 h-8 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                  </div>
                  <h3 className="font-semibold text-gray-900 mb-1">Vibe Code Editor</h3>
                  <p className="text-sm text-gray-500 mb-1">
                    Describe what you want to change about the operator workflow in plain English.
                    Claude will update the YAML template and generate any custom React components needed.
                  </p>
                  <p className="text-xs text-gray-400 mb-4">
                    The YAML on the left defines the steps operators walk through, the web panels they see, and the data they collect. Changes take effect immediately for new tasks.
                  </p>
                  <div className="space-y-2">
                    <p className="text-xs text-gray-400 font-medium">Try something like:</p>
                    {[
                      'Add a step where the operator rates the website quality on a scale of 1-5',
                      'Add a step asking if the business appears to be permanently closed',
                      'Make the notes field required and rename it to "observations"',
                    ].map((suggestion, i) => (
                      <button
                        key={i}
                        onClick={() => setInput(suggestion)}
                        className="block w-full text-left px-3 py-2 text-xs text-gray-600 bg-white border border-gray-200 rounded-lg hover:border-indigo-300 hover:bg-indigo-50 transition-colors"
                      >
                        "{suggestion}"
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[90%] ${msg.role === 'user' ? 'order-1' : ''}`}>
                  <div
                    className={`rounded-xl px-4 py-3 text-sm ${
                      msg.role === 'user'
                        ? 'bg-indigo-600 text-white'
                        : 'bg-white border border-gray-200 text-gray-700'
                    }`}
                  >
                    {msg.content}
                  </div>

                  {/* Diff view for assistant messages with vibe response */}
                  {msg.vibeResponse && (
                    <div className="mt-3 space-y-3">
                      <YamlDiffView
                        original={msg.vibeResponse.original_yaml}
                        updated={msg.vibeResponse.updated_yaml}
                      />

                      {msg.vibeResponse.new_components.length > 0 && (
                        <div className="rounded-lg border border-gray-200 overflow-hidden">
                          <div className="px-3 py-2 bg-gray-100 text-xs font-medium text-gray-600">
                            New Components
                          </div>
                          {msg.vibeResponse.new_components.map((comp, ci) => (
                            <div key={ci} className="border-t border-gray-200">
                              <div className="px-3 py-1.5 bg-gray-50 text-xs font-mono text-indigo-600">
                                {comp.name}.tsx
                              </div>
                              <pre className="text-xs p-3 overflow-auto max-h-48 bg-gray-950 text-gray-300">
                                {comp.code}
                              </pre>
                            </div>
                          ))}
                        </div>
                      )}

                      {!msg.approved ? (
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleApprove(i)}
                            className="px-4 py-2 bg-green-600 text-white text-xs font-semibold rounded-lg hover:bg-green-700 transition-colors"
                          >
                            Approve & Apply
                          </button>
                          <button
                            onClick={() => {}} // Just dismiss — user can type a new request
                            className="px-4 py-2 text-xs text-gray-500 hover:text-gray-700 transition-colors"
                          >
                            Dismiss
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 text-xs text-green-600 font-medium">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          Changes applied
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex justify-start">
                <div className="bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-500">
                  <div className="flex items-center gap-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-indigo-600" />
                    Thinking...
                  </div>
                </div>
              </div>
            )}

            <div ref={chatEndRef} />
          </div>

          {/* Input */}
          <div className="border-t border-gray-200 bg-white p-4">
            <div className="flex gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSubmit()}
                placeholder="Describe the change you want to make..."
                disabled={loading || !selectedId}
                className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none disabled:opacity-50 transition-all"
              />
              <button
                onClick={handleSubmit}
                disabled={loading || !input.trim() || !selectedId}
                className="px-5 py-2.5 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Send
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
