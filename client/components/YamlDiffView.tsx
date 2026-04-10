import { createTwoFilesPatch } from 'diff';
import { useMemo } from 'react';

interface YamlDiffViewProps {
  original: string;
  updated: string;
}

interface DiffLine {
  type: 'add' | 'remove' | 'context' | 'header';
  content: string;
}

export default function YamlDiffView({ original, updated }: YamlDiffViewProps) {
  const lines = useMemo(() => {
    const patch = createTwoFilesPatch('original.yaml', 'updated.yaml', original, updated, '', '', { context: 3 });
    const result: DiffLine[] = [];

    for (const line of patch.split('\n')) {
      if (line.startsWith('@@')) {
        result.push({ type: 'header', content: line });
      } else if (line.startsWith('+') && !line.startsWith('+++')) {
        result.push({ type: 'add', content: line.slice(1) });
      } else if (line.startsWith('-') && !line.startsWith('---')) {
        result.push({ type: 'remove', content: line.slice(1) });
      } else if (!line.startsWith('+++') && !line.startsWith('---') && !line.startsWith('Index') && !line.startsWith('=')) {
        result.push({ type: 'context', content: line.startsWith(' ') ? line.slice(1) : line });
      }
    }

    return result;
  }, [original, updated]);

  return (
    <div className="rounded-lg border border-gray-200 overflow-hidden bg-gray-950">
      <div className="overflow-auto max-h-96">
        <pre className="text-xs leading-5 p-0 m-0">
          {lines.map((line, i) => (
            <div
              key={i}
              className={`px-4 ${
                line.type === 'add'
                  ? 'bg-green-900/40 text-green-300'
                  : line.type === 'remove'
                  ? 'bg-red-900/40 text-red-300'
                  : line.type === 'header'
                  ? 'bg-indigo-900/30 text-indigo-300 font-medium'
                  : 'text-gray-400'
              }`}
            >
              <span className="select-none mr-2 text-gray-600">
                {line.type === 'add' ? '+' : line.type === 'remove' ? '-' : line.type === 'header' ? '@' : ' '}
              </span>
              {line.content}
            </div>
          ))}
        </pre>
      </div>
    </div>
  );
}
