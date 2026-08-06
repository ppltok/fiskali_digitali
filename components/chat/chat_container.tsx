'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import type { UIMessage } from 'ai';
import Image from 'next/image';
import { Moon, Sun, ArrowDown } from 'lucide-react';
import MessageBubble from './message_bubble';
import MessageInput from './message_input';
import StarterQuestions from './starter_questions';
import ConversationSidebar from './conversation_sidebar';
import SettingsDrawer from './settings_drawer';
import {
  listConversations,
  loadConversation,
  saveConversation,
  deleteConversation,
  getUserKey,
  type ConversationMeta,
} from '@/lib/storage';

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
    // Also flip color-scheme: fixes native form controls AND forces the
    // compositor to repaint the blurred sticky header, which otherwise can
    // keep stale-theme pixels.
    document.documentElement.style.colorScheme = next;
    localStorage.setItem('fiskali_theme', next);
  };
  return toggle;
}

// The first stream chunk can take a while when the free-tier per-minute quota
// is busy (the server waits it out with backoff). Be honest about the wait
// instead of looking hung.
function PendingIndicator() {
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setSlow(true), 8000);
    return () => clearTimeout(t);
  }, []);
  return (
    <div className="rise-in flex items-center gap-2 text-sm text-ink-faint">
      <span className="relative flex size-2.5">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-60" />
        <span className="relative inline-flex size-2.5 rounded-full bg-accent" />
      </span>
      {slow
        ? 'המכסה החינמית עמוסה כרגע — ממתינים בתור, זה יכול לקחת עד דקה-שתיים…'
        : 'מתחבר למפתח התקציב…'}
    </div>
  );
}

function ChatView({
  convo_id,
  initial_messages,
  onSaved,
}: {
  convo_id: string;
  initial_messages: UIMessage[];
  onSaved: () => void;
}) {
  const [input, setInput] = useState('');
  // "Stick to bottom": follow the stream unless the user scrolled away.
  const [stuck, setStuck] = useState(true);
  const stuck_ref = useRef(true);

  const { messages, sendMessage, status, stop, error } = useChat({
    id: convo_id,
    messages: initial_messages,
    transport: new DefaultChatTransport({
      api: '/api/chat',
      headers: (): Record<string, string> => {
        const user_key = getUserKey();
        return user_key ? { 'x-user-key': user_key } : {};
      },
    }),
  });

  const busy = status === 'submitted' || status === 'streaming';
  const empty = messages.length === 0;

  useEffect(() => {
    const onScroll = () => {
      const near_bottom =
        window.innerHeight + window.scrollY >= document.body.scrollHeight - 180;
      stuck_ref.current = near_bottom;
      setStuck(near_bottom);
    };
    // Wheel-up / touch are explicit "stop following" intent — don't make the
    // user's gesture race the stream's re-pin cadence.
    const onWheel = (e: WheelEvent) => {
      if (e.deltaY < 0) {
        stuck_ref.current = false;
        setStuck(false);
      }
    };
    const onTouchStart = () => {
      stuck_ref.current = false;
      setStuck(false);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('wheel', onWheel, { passive: true });
    window.addEventListener('touchstart', onTouchStart, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('wheel', onWheel);
      window.removeEventListener('touchstart', onTouchStart);
    };
  }, []);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'auto') => {
    window.scrollTo({ top: document.body.scrollHeight, behavior });
  }, []);

  // Follow the stream while stuck to the bottom. 'auto' (instant) because
  // repeated smooth scrolls cancel each other and end up not moving at all.
  useEffect(() => {
    if (stuck_ref.current) scrollToBottom();
  }, [messages, scrollToBottom]);

  // Persist after each completed exchange (and restore-on-reload comes free).
  useEffect(() => {
    if (status === 'ready' && messages.length > 0) {
      saveConversation(convo_id, messages);
      onSaved();
    }
  }, [status, messages, convo_id, onSaved]);

  const ask = (text: string) => {
    if (busy || !text.trim()) return;
    sendMessage({ text });
    setInput('');
    stuck_ref.current = true;
    setStuck(true);
    // After React commits the new user message, bring it into view.
    requestAnimationFrame(() => scrollToBottom());
  };

  return (
    <>
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 pb-40 pt-6">
        {empty ? (
          <div className="mt-8 sm:mt-16">
            <p className="rise-in mb-3 inline-flex items-center gap-2 rounded-full bg-accent-soft px-3 py-1 text-xs font-semibold text-accent-strong">
              רדיקלי, לא קיצוני · תנועת עלינו
            </p>
            <h1
              className="rise-in font-display text-4xl font-bold leading-[1.15] text-ink sm:text-5xl"
              style={{ animationDelay: '60ms' }}
            >
              אי אפשר לתקן
              <br />
              <span className="text-accent">את מה שלא רואים.</span>
            </h1>
            <p
              className="rise-in mt-5 max-w-xl text-[15px] leading-relaxed text-ink-soft"
              style={{ animationDelay: '120ms' }}
            >
              שינוי מן היסוד מתחיל בהבנה של המספרים. שאלו כאן כל שאלה על תקציב מדינת
              ישראל — בעברית פשוטה — וקבלו תשובה מגובה בנתונים חיים ממפתח התקציב, עם
              מקורות, שאילתות גלויות ותרשימים. בלי פרשנות, בלי סיסמאות. זה עלינו.
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
                onAsk={ask}
              />
            ))}
            {status === 'submitted' && <PendingIndicator />}
            {error && (
              <div className="rise-in mt-3 rounded-xl border border-negative/30 bg-negative/5 px-4 py-3 text-sm text-negative">
                {error.message || 'אירעה שגיאה. נסו שוב.'}
              </div>
            )}
          </div>
        )}
      </main>

      <div className="fixed inset-x-0 bottom-0 z-10 bg-gradient-to-t from-paper via-paper/95 to-transparent pb-4 pt-8">
        <div className="relative mx-auto w-full max-w-3xl px-4">
          {!stuck && !empty && (
            <button
              onClick={() => scrollToBottom('smooth')}
              aria-label="קפוץ לסוף השיחה"
              className="absolute -top-12 start-1/2 flex size-9 -translate-x-1/2 items-center justify-center rounded-full border border-hairline bg-surface-raised text-ink-soft shadow-lg transition-colors hover:border-accent hover:text-accent rtl:translate-x-1/2"
            >
              <ArrowDown className="size-4" />
            </button>
          )}
          <MessageInput
            value={input}
            onChange={setInput}
            onSubmit={() => ask(input)}
            onStop={stop}
            busy={busy}
          />
          <div className="mt-2.5 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-[11px] text-ink-faint">
            <span>מערכת של</span>
            <a
              href="https://www.alenu.org/"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="תנועת עלינו"
              className="transition-opacity hover:opacity-70"
            >
              <Image
                src="/alenu_logo.svg"
                alt="עלינו"
                width={58}
                height={25}
                className="h-4 w-auto translate-y-px"
              />
            </a>
            <span aria-hidden>·</span>
            <span>
              נתונים ממפתח התקציב (obudget.org) · תשובות מופקות בידי מודל שפה — אמתו
              נתונים קריטיים במקור
            </span>
          </div>
        </div>
      </div>
    </>
  );
}

export default function ChatContainer() {
  const toggleTheme = useThemeToggle();
  const [convo_id, setConvoId] = useState<string | null>(null);
  const [initial_messages, setInitialMessages] = useState<UIMessage[]>([]);
  const [conversations, setConversations] = useState<ConversationMeta[]>([]);

  // Hydrate id + history on the client only (localStorage + randomUUID are
  // browser-side; doing this in render would break SSR hydration).
  useEffect(() => {
    setConversations(listConversations());
    setConvoId(crypto.randomUUID());
  }, []);

  const refreshList = useCallback(() => setConversations(listConversations()), []);

  const newConversation = () => {
    setInitialMessages([]);
    setConvoId(crypto.randomUUID());
  };

  const selectConversation = (id: string) => {
    const messages = loadConversation(id);
    if (messages) {
      setInitialMessages(messages);
      setConvoId(id);
    }
  };

  const removeConversation = (id: string) => {
    deleteConversation(id);
    refreshList();
    if (id === convo_id) newConversation();
  };

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-20 border-b border-hairline bg-paper/85 backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between px-4 py-3">
          <a
            href="https://www.alenu.org/"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2.5 transition-opacity hover:opacity-80"
            aria-label="עלינו — דברו עם התקציב"
          >
            <Image
              src="/alenu_mark.svg"
              alt=""
              width={32}
              height={32}
              className="size-8"
              priority
            />
            <div className="leading-tight">
              <p className="font-display text-lg font-bold text-ink">דברו עם התקציב</p>
              <p className="hidden text-[11px] text-ink-faint sm:block">
                מערכת של תנועת עלינו · נתונים ממפתח התקציב
              </p>
            </div>
          </a>
          <div className="flex items-center gap-1.5">
            <ConversationSidebar
              conversations={conversations}
              active_id={convo_id ?? ''}
              onSelect={selectConversation}
              onNew={newConversation}
              onDelete={removeConversation}
            />
            <SettingsDrawer />
            <button
              onClick={toggleTheme}
              aria-label="החלף מצב תצוגה"
              className="flex size-8 items-center justify-center rounded-lg border border-hairline text-ink-soft transition-colors hover:border-accent hover:text-accent"
            >
              <Sun className="size-4 dark:hidden [[data-theme='dark']_&]:hidden" />
              <Moon className="hidden size-4 dark:block [[data-theme='dark']_&]:block [[data-theme='light']_&]:hidden" />
            </button>
          </div>
        </div>
      </header>

      {convo_id && (
        <ChatView
          key={convo_id}
          convo_id={convo_id}
          initial_messages={initial_messages}
          onSaved={refreshList}
        />
      )}
    </div>
  );
}
