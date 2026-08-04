'use client';

import { useState, useRef, useEffect } from 'react';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { Landmark, Moon, Sun } from 'lucide-react';
import MessageBubble from './message_bubble';
import MessageInput from './message_input';
import StarterQuestions from './starter_questions';

function useThemeToggle() {
  const [theme, setTheme] = useState<'light' | 'dark' | null>(null);
  useEffect(() => {
    const stored = localStorage.getItem('fiskali_theme') as 'light' | 'dark' | null;
    if (stored) {
      setTheme(stored);
      document.documentElement.dataset.theme = stored;
    }
  }, []);
  const toggle = () => {
    const current =
      theme ??
      (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    const next = current === 'dark' ? 'light' : 'dark';
    setTheme(next);
    document.documentElement.dataset.theme = next;
    localStorage.setItem('fiskali_theme', next);
  };
  return toggle;
}

export default function ChatContainer() {
  const [input, setInput] = useState('');
  const bottom_ref = useRef<HTMLDivElement>(null);
  const toggleTheme = useThemeToggle();

  const { messages, sendMessage, status, stop, error } = useChat({
    transport: new DefaultChatTransport({ api: '/api/chat' }),
  });

  const busy = status === 'submitted' || status === 'streaming';
  const empty = messages.length === 0;

  useEffect(() => {
    bottom_ref.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages]);

  const ask = (text: string) => {
    sendMessage({ text });
    setInput('');
  };

  return (
    <div className="flex min-h-dvh flex-col">
      {/* Masthead */}
      <header className="sticky top-0 z-10 border-b border-hairline bg-paper/85 backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2.5">
            <span className="flex size-8 items-center justify-center rounded-lg bg-accent text-white">
              <Landmark className="size-4.5" />
            </span>
            <div className="leading-tight">
              <p className="font-display text-lg text-ink">פיסקלי דיגיטלי</p>
              <p className="text-[11px] text-ink-faint">שיחה חיה עם תקציב המדינה · מפתח התקציב</p>
            </div>
          </div>
          <button
            onClick={toggleTheme}
            aria-label="החלף מצב תצוגה"
            className="flex size-8 items-center justify-center rounded-lg border border-hairline text-ink-soft transition-colors hover:border-accent hover:text-accent"
          >
            <Sun className="size-4 dark:hidden [[data-theme='dark']_&]:hidden" />
            <Moon className="hidden size-4 dark:block [[data-theme='dark']_&]:block [[data-theme='light']_&]:hidden" />
          </button>
        </div>
      </header>

      {/* Conversation column */}
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 pb-40 pt-6">
        {empty ? (
          <div className="mt-8 sm:mt-16">
            <p className="rise-in mb-2 text-xs font-medium uppercase tracking-widest text-accent">
              נתונים חיים · 1997–2026
            </p>
            <h1
              className="rise-in font-display text-4xl leading-tight text-ink sm:text-5xl"
              style={{ animationDelay: '60ms' }}
            >
              למה הולך הכסף
              <br />
              <span className="text-accent">שלך?</span>
            </h1>
            <p
              className="rise-in mt-4 max-w-xl text-[15px] leading-relaxed text-ink-soft"
              style={{ animationDelay: '120ms' }}
            >
              שאלו כל שאלה על תקציב מדינת ישראל — בעברית פשוטה. התשובות מגיעות ישירות
              ממסד הנתונים הפתוח של מפתח התקציב, עם מקורות, שאילתות שקופות ותרשימים.
            </p>
            <div className="mt-8">
              <StarterQuestions onSelect={ask} />
            </div>
          </div>
        ) : (
          <div>
            {messages.map((message, i) => (
              <MessageBubble
                key={message.id}
                message={message}
                is_last={i === messages.length - 1}
                streaming={busy}
              />
            ))}
            {status === 'submitted' && (
              <div className="rise-in flex items-center gap-2 text-sm text-ink-faint">
                <span className="relative flex size-2.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-60" />
                  <span className="relative inline-flex size-2.5 rounded-full bg-accent" />
                </span>
                מתחבר למפתח התקציב…
              </div>
            )}
            {error && (
              <div className="rise-in mt-3 rounded-xl border border-negative/30 bg-negative/5 px-4 py-3 text-sm text-negative">
                {error.message || 'אירעה שגיאה. נסו שוב.'}
              </div>
            )}
            <div ref={bottom_ref} className="h-px" />
          </div>
        )}
      </main>

      {/* Composer */}
      <div className="fixed inset-x-0 bottom-0 z-10 bg-gradient-to-t from-paper via-paper/95 to-transparent pb-4 pt-8">
        <div className="mx-auto w-full max-w-3xl px-4">
          <MessageInput
            value={input}
            onChange={setInput}
            onSubmit={() => ask(input)}
            onStop={stop}
            busy={busy}
          />
          <p className="mt-2 text-center text-[11px] text-ink-faint">
            הנתונים ממפתח התקציב (obudget.org) · תשובות מופקות בידי מודל שפה — אמתו נתונים קריטיים במקור
          </p>
        </div>
      </div>
    </div>
  );
}
