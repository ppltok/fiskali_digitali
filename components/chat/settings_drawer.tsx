'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Settings2, X, KeyRound } from 'lucide-react';
import { getUserKey, setUserKey } from '@/lib/storage';

// BYO-key drawer: a visitor can use their own free OpenRouter key. It lives
// only in this browser's localStorage and is sent as a request header — the
// server uses it instead of the shared key, so their quota is their own.
export default function SettingsDrawer() {
  const [open, setOpen] = useState(false);
  const [key, setKey] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (open) setKey(getUserKey());
  }, [open]);

  const save = () => {
    setUserKey(key);
    setSaved(true);
    setTimeout(() => setSaved(false), 1600);
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="הגדרות"
        title="הגדרות"
        className="flex size-8 items-center justify-center rounded-lg border border-hairline text-ink-soft transition-colors hover:border-accent hover:text-accent"
      >
        <Settings2 className="size-4" />
      </button>

      {open &&
        createPortal(
        <div className="fixed inset-0 z-30" role="dialog" aria-label="הגדרות">
          <button
            aria-label="סגור"
            className="absolute inset-0 bg-ink/25 backdrop-blur-[2px]"
            onClick={() => setOpen(false)}
          />
          <div className="absolute start-1/2 top-24 w-[26rem] max-w-[92vw] -translate-x-1/2 rounded-2xl border border-hairline bg-surface p-5 shadow-2xl rtl:translate-x-1/2">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="flex items-center gap-2 font-display text-base text-ink">
                <KeyRound className="size-4 text-accent" />
                מפתח OpenRouter אישי
              </h3>
              <button
                onClick={() => setOpen(false)}
                aria-label="סגור"
                className="rounded-md p-1 text-ink-faint hover:text-ink"
              >
                <X className="size-4" />
              </button>
            </div>
            <p className="mb-3 text-[13px] leading-relaxed text-ink-soft">
              האתר משתמש במכסה חינמית משותפת ומוגבלת. אם היא נגמרה — אפשר ליצור{' '}
              <a
                href="https://openrouter.ai/keys"
                target="_blank"
                rel="noopener noreferrer"
                className="text-accent underline decoration-accent/40 underline-offset-2"
              >
                מפתח חינמי משלכם
              </a>{' '}
              ולהדביק אותו כאן. המפתח נשמר בדפדפן שלכם בלבד ואינו נשלח לשום מקום מלבד
              OpenRouter.
            </p>
            <input
              type="password"
              dir="ltr"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              placeholder="sk-or-v1-…"
              aria-label="מפתח OpenRouter"
              className="mb-3 w-full rounded-lg border border-hairline-strong bg-surface-raised px-3 py-2 font-figures text-sm text-ink outline-none focus:border-accent"
            />
            <div className="flex items-center justify-between">
              <button
                onClick={save}
                className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-strong"
              >
                {saved ? '✓ נשמר' : 'שמירה'}
              </button>
              {key && (
                <button
                  onClick={() => {
                    setKey('');
                    setUserKey('');
                  }}
                  className="text-xs text-ink-faint hover:text-negative"
                >
                  הסר מפתח
                </button>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
