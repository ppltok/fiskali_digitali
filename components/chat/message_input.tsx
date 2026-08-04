'use client';

import { useRef, useEffect } from 'react';
import { ArrowUp, Square } from 'lucide-react';

export default function MessageInput({
  value,
  onChange,
  onSubmit,
  onStop,
  busy,
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  onStop: () => void;
  busy: boolean;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    // Empty value keeps the natural single-row height; measuring at mount can
    // race stylesheet loading and freeze a bogus height.
    if (value) el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [value]);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!busy && value.trim()) onSubmit();
      }}
      className="relative"
    >
      <textarea
        ref={ref}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            if (!busy && value.trim()) onSubmit();
          }
        }}
        rows={1}
        placeholder="שאלו כל שאלה על תקציב המדינה…"
        aria-label="שאלה על תקציב המדינה"
        className="w-full resize-none rounded-2xl border border-hairline-strong bg-surface-raised py-3.5 pe-14 ps-5 text-[15px] text-ink shadow-[0_4px_24px_-12px_rgba(29,26,20,0.25)] outline-none transition-colors placeholder:text-ink-faint focus:border-accent"
      />
      {busy ? (
        <button
          type="button"
          onClick={onStop}
          aria-label="עצור"
          className="absolute end-2.5 top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-xl bg-ink text-paper transition-transform hover:scale-105"
        >
          <Square className="size-3.5 fill-current" />
        </button>
      ) : (
        <button
          type="submit"
          disabled={!value.trim()}
          aria-label="שלח"
          className="absolute end-2.5 top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-xl bg-accent text-white transition-all hover:bg-accent-strong disabled:opacity-30"
        >
          <ArrowUp className="size-4" />
        </button>
      )}
    </form>
  );
}
