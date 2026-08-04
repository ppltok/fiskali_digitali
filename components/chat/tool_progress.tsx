'use client';

import { useState } from 'react';
import { ChevronDown, Database, Search, Info, CircleAlert, Check } from 'lucide-react';

const TOOL_LABELS: Record<string, { running: string; done: string; icon: typeof Database }> = {
  DatasetInfo: { running: 'קורא מבנה נתונים…', done: 'מבנה הנתונים נקרא', icon: Info },
  DatasetFullTextSearch: { running: 'מחפש במאגר…', done: 'החיפוש הושלם', icon: Search },
  DatasetDBQuery: { running: 'מריץ שאילתה…', done: 'השאילתה הושלמה', icon: Database },
};

export interface ToolProgressProps {
  tool_name: string;
  state: 'input-streaming' | 'input-available' | 'output-available' | 'output-error';
  input?: unknown;
  error_text?: string;
}

export default function ToolProgress({ tool_name, state, input, error_text }: ToolProgressProps) {
  const [open, setOpen] = useState(false);
  const meta = TOOL_LABELS[tool_name] ?? {
    running: `מפעיל ${tool_name}…`,
    done: tool_name,
    icon: Database,
  };
  const Icon = meta.icon;
  const running = state === 'input-streaming' || state === 'input-available';
  const failed = state === 'output-error';

  const sql =
    input && typeof input === 'object' && 'query' in (input as Record<string, unknown>)
      ? String((input as Record<string, unknown>).query)
      : null;
  const search_q =
    input && typeof input === 'object' && 'q' in (input as Record<string, unknown>)
      ? String((input as Record<string, unknown>).q)
      : null;

  return (
    <div className="rise-in my-1.5">
      <button
        onClick={() => setOpen((v) => !v)}
        disabled={!sql && !search_q}
        className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs transition-colors ${
          failed
            ? 'border-negative/40 bg-negative/5 text-negative'
            : running
              ? 'border-hairline bg-surface text-ink-soft'
              : 'border-hairline bg-surface text-ink-faint hover:text-ink-soft'
        } ${sql || search_q ? 'cursor-pointer' : 'cursor-default'}`}
      >
        {failed ? (
          <CircleAlert className="size-3.5" />
        ) : running ? (
          <span className="relative flex size-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-60" />
            <span className="relative inline-flex size-2.5 rounded-full bg-accent" />
          </span>
        ) : (
          <Check className="size-3.5 text-accent" />
        )}
        <Icon className="size-3.5" />
        <span>{failed ? `שגיאה ב-${tool_name}` : running ? meta.running : meta.done}</span>
        {search_q && <span className="max-w-40 truncate font-medium">‹{search_q}›</span>}
        {(sql || search_q) && (
          <ChevronDown className={`size-3 transition-transform ${open ? 'rotate-180' : ''}`} />
        )}
      </button>
      {open && sql && (
        <pre
          dir="ltr"
          className="mt-1.5 whitespace-pre-wrap break-words rounded-lg border border-hairline bg-surface-raised p-3 text-start font-figures text-[11px] leading-relaxed text-ink-soft"
        >
          {sql}
        </pre>
      )}
      {failed && error_text && (
        <p className="mt-1 text-xs text-negative">{error_text}</p>
      )}
    </div>
  );
}
