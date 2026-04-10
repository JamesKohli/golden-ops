import { useState, useRef } from 'react';

interface EvidenceCaptureProps {
  taskId: string;
  stepId: string;
  currentPath: string | null;
  onUploaded: (path: string) => void;
  onStartBoxDraw: () => void;
  boxData: BoxData | null;
}

export interface BoxData {
  x: number;
  y: number;
  w: number;
  h: number;
  panelLabel: string;
}

export default function EvidenceCapture({
  taskId,
  stepId,
  currentPath,
  onUploaded,
  onStartBoxDraw,
  boxData,
}: EvidenceCaptureProps) {
  const [uploading, setUploading] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    setUploading(true);
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch(`/api/tasks/${taskId}/evidence/${stepId}`, { method: 'POST', body: form });
      const data = await res.json();
      onUploaded(data.path);
      setShowUpload(false);
    } catch (e) {
      console.error('Upload failed', e);
    } finally {
      setUploading(false);
    }
  };

  const hasBox = !!boxData;
  const hasScreenshot = !!currentPath;

  return (
    <div className="space-y-2">
      {/* Box highlight status */}
      {hasBox ? (
        <div className="flex items-center gap-2 px-3 py-2 bg-indigo-50 border border-indigo-200 rounded-lg">
          <svg className="w-4 h-4 text-indigo-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h4a1 1 0 010 2H5a1 1 0 01-1-1zM4 13a1 1 0 011-1h4a1 1 0 010 2H5a1 1 0 01-1-1zM15 5a1 1 0 011-1h4a1 1 0 010 2h-4a1 1 0 01-1-1zM15 13a1 1 0 011-1h4a1 1 0 010 2h-4a1 1 0 01-1-1z" />
          </svg>
          <span className="text-sm font-medium text-indigo-700 flex-1">
            Box drawn on {boxData.panelLabel}
          </span>
          <button
            onClick={onStartBoxDraw}
            className="text-xs text-indigo-600 hover:text-indigo-800 underline"
          >
            Redraw
          </button>
        </div>
      ) : (
        <button
          onClick={onStartBoxDraw}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-indigo-300 rounded-lg text-sm font-medium text-indigo-600 hover:bg-indigo-50 hover:border-indigo-400 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 5a1 1 0 011-1h4a1 1 0 010 2H5a1 1 0 01-1-1zM4 13a1 1 0 011-1h4a1 1 0 010 2H5a1 1 0 01-1-1zM15 5a1 1 0 011-1h4a1 1 0 010 2h-4a1 1 0 01-1-1zM15 13a1 1 0 011-1h4a1 1 0 010 2h-4a1 1 0 01-1-1z" />
          </svg>
          Draw box on web panel
        </button>
      )}

      {/* Screenshot upload — secondary */}
      {hasScreenshot ? (
        <div className="flex items-center gap-2 px-3 py-2 bg-green-50 border border-green-200 rounded-lg">
          <svg className="w-4 h-4 text-green-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          <span className="text-sm font-medium text-green-700 flex-1">Screenshot attached</span>
          <button
            onClick={() => fileRef.current?.click()}
            className="text-xs text-green-600 hover:text-green-800 underline"
          >
            Replace
          </button>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
        </div>
      ) : !showUpload ? (
        <button
          onClick={() => setShowUpload(true)}
          className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
        >
          + Attach screenshot (optional)
        </button>
      ) : (
        <div className="flex items-center gap-2">
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="text-xs text-gray-500 file:mr-2 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-medium file:bg-gray-100 file:text-gray-600 hover:file:bg-gray-200"
            onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
          />
          {uploading && <span className="text-xs text-gray-400">Uploading...</span>}
          <button onClick={() => setShowUpload(false)} className="text-xs text-gray-400 hover:text-gray-600">Cancel</button>
        </div>
      )}
    </div>
  );
}
