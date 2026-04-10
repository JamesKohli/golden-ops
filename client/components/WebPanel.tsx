import { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { resolveVariable } from '../../shared/engine.js';
import type { DataSource, PanelSourceRef } from '../../shared/types.js';
import type { BoxData } from './EvidenceCapture';

interface WebPanelProps {
  panels: PanelSourceRef[];
  dataSources: DataSource[];
  context: Record<string, any>;
  drawMode: boolean;
  onBoxDrawn: (box: BoxData) => void;
  onCancelDraw: () => void;
  boxes: BoxData[];
}

export default function WebPanel({
  panels,
  dataSources,
  context,
  drawMode,
  onBoxDrawn,
  onCancelDraw,
  boxes: savedBoxes,
}: WebPanelProps) {
  const [activeTab, setActiveTab] = useState(0);
  const overlayRef = useRef<HTMLDivElement>(null);
  const [drawStart, setDrawStart] = useState<{ x: number; y: number } | null>(null);
  const [liveBox, setLiveBox] = useState<{ x: number; y: number; w: number; h: number } | null>(null);

  const sourceMap = useMemo(() => {
    const map = new Map<string, DataSource>();
    for (const ds of dataSources) map.set(ds.id, ds);
    return map;
  }, [dataSources]);

  const resolvedUrls = useMemo(() => {
    return panels.map((panel) => {
      const ds = sourceMap.get(panel.source);
      if (!ds) return '';
      const url = resolveVariable(ds.url_template, context);
      if (!url || url.includes('{{')) return '';
      // Upgrade http to https to avoid mixed content blocking in production
      return url.replace(/^http:\/\//, 'https://');
    });
  }, [panels, sourceMap, context]);

  const getRelativePos = useCallback((e: React.MouseEvent) => {
    const rect = overlayRef.current!.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(e.clientX - rect.left, rect.width)),
      y: Math.max(0, Math.min(e.clientY - rect.top, rect.height)),
    };
  }, []);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!drawMode) return;
    const pos = getRelativePos(e);
    setDrawStart(pos);
    setLiveBox(null);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!drawMode || !drawStart) return;
    const pos = getRelativePos(e);
    setLiveBox({
      x: Math.min(drawStart.x, pos.x),
      y: Math.min(drawStart.y, pos.y),
      w: Math.abs(pos.x - drawStart.x),
      h: Math.abs(pos.y - drawStart.y),
    });
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    if (!drawMode || !drawStart) return;
    const pos = getRelativePos(e);
    const box = {
      x: Math.min(drawStart.x, pos.x),
      y: Math.min(drawStart.y, pos.y),
      w: Math.abs(pos.x - drawStart.x),
      h: Math.abs(pos.y - drawStart.y),
    };
    setDrawStart(null);
    setLiveBox(null);
    if (box.w > 10 && box.h > 10) {
      onBoxDrawn({ ...box, panelLabel: panels[activeTab]?.label || 'Web panel' });
    }
  };

  const [iframeError, setIframeError] = useState<string | null>(null);

  // Reset error when URL changes
  useEffect(() => { setIframeError(null); }, [resolvedUrls[activeTab]]);

  // Show the in-progress draw box, or all saved boxes
  const displayBoxes: BoxData[] = liveBox ? [liveBox as BoxData] : (!drawMode ? savedBoxes : []);

  return (
    <div className="flex flex-col h-full bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
      {/* Tabs */}
      <div className="flex border-b border-gray-200 bg-gray-50">
        {panels.map((panel, index) => (
          <button
            key={panel.source}
            onClick={() => setActiveTab(index)}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === index
                ? 'text-indigo-600 border-b-2 border-indigo-600 bg-white'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
            }`}
          >
            {panel.label}
          </button>
        ))}
      </div>

      {/* Draw mode banner */}
      {drawMode && (
        <div className="px-4 py-2 bg-indigo-600 text-white flex items-center justify-between">
          <span className="text-sm font-medium">Draw a box around the evidence</span>
          <button onClick={onCancelDraw} className="text-xs text-indigo-200 hover:text-white underline">
            Cancel
          </button>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 relative">
        {resolvedUrls[activeTab] ? (
          <>
            {!iframeError ? (
              <iframe
                key={resolvedUrls[activeTab]}
                src={resolvedUrls[activeTab]}
                className="absolute inset-0 w-full h-full border-0"
                sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
                referrerPolicy="no-referrer"
                allowFullScreen
                onError={() => setIframeError('blocked')}
              />
            ) : null}
            {/* Open externally link */}
            <div className={`absolute bottom-0 left-0 right-0 bg-white/90 backdrop-blur-sm border-t border-gray-200 px-4 py-2 flex items-center justify-between ${iframeError ? 'top-0 items-center justify-center flex-col gap-3 border-t-0' : ''}`}>
              {iframeError ? (
                <p className="text-sm text-gray-500 text-center">This website blocks embedded previews.</p>
              ) : (
                <span className="text-xs text-gray-400">Some sites won't load here due to security restrictions</span>
              )}
              <a
                href={resolvedUrls[activeTab]}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-indigo-600 hover:text-indigo-800 font-medium flex items-center gap-1"
              >
                Open in new tab
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
            </div>
            {/* Draw overlay */}
            {drawMode && (
              <div
                ref={overlayRef}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                className="absolute inset-0 cursor-crosshair"
                style={{ background: 'rgba(0,0,0,0.05)' }}
              />
            )}
            {/* Persistent box display + draw-in-progress box */}
            {displayBoxes.map((box, i) => box.w > 0 && (
              <div
                key={i}
                className="absolute pointer-events-none border-2 border-indigo-500 rounded-sm"
                style={{
                  left: box.x,
                  top: box.y,
                  width: box.w,
                  height: box.h,
                  boxShadow: displayBoxes.length === 1 ? '0 0 0 9999px rgba(0,0,0,0.25)' : undefined,
                  backgroundColor: displayBoxes.length > 1 ? 'rgba(99,102,241,0.1)' : undefined,
                }}
              />
            ))}
          </>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-50">
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-100 flex items-center justify-center">
                <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                    d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9" />
                </svg>
              </div>
              <p className="text-sm text-gray-500">
                {panels[activeTab]?.label || 'Web view'} will load<br />
                when the URL is provided
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
