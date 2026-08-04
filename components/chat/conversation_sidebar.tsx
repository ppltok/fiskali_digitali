'use client';

import { useState } from 'react';
import { createPortal } from 'react-dom';
import { MessageSquarePlus, Trash2, History, X } from 'lucide-react';
import type { ConversationMeta } from '@/lib/storage';

function relativeTime(ts: number): string {
  const minutes = Math.round((Date.now() - ts) / 60000);
  if (minutes < 1) return 'עכשיו';
  if (minutes < 60) return `לפני ${minutes} דק׳`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `לפני ${hours} שע׳`;
  const days = Math.round(hours / 24);
  if (days === 1) return 'אתמול';
  if (days < 30) return `לפני ${days} ימים`;
  return new Date(ts).toLocaleDateString('he-IL');
}

export default function ConversationSidebar({
  conversations,
  active_id,
  onSelect,
  onNew,
  onDelete,
}: {
  conversations: ConversationMeta[];
  active_id: string;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <div className="flex items-center gap-1.5">
        <button
          onClick={onNew}
          aria-label="שיחה חדשה"
          title="שיחה חדשה"
          className="flex size-8 items-center justify-center rounded-lg border border-hairline text-ink-soft transition-colors hover:border-accent hover:text-accent"
        >
          <MessageSquarePlus className="size-4" />
        </button>
        <button
          onClick={() => setOpen(true)}
          aria-label="היסטוריית שיחות"
          title="היסטוריית שיחות"
          className="flex size-8 items-center justify-center rounded-lg border border-hairline text-ink-soft transition-colors hover:border-accent hover:text-accent"
        >
          <History className="size-4" />
        </button>
      </div>

      {/* Portal: the sticky header's backdrop-filter makes it a containing
          block for fixed descendants, which would trap this overlay inside it. */}
      {open &&
        createPortal(
        <div className="fixed inset-0 z-30" role="dialog" aria-label="היסטוריית שיחות">
          <button
            aria-label="סגור"
            className="absolute inset-0 bg-ink/25 backdrop-blur-[2px]"
            onClick={() => setOpen(false)}
          />
          <aside className="absolute inset-y-0 start-0 flex w-80 max-w-[85vw] flex-col border-e border-hairline bg-surface shadow-2xl">
            <div className="flex items-center justify-between border-b border-hairline px-4 py-3">
              <h3 className="font-display text-base text-ink">שיחות קודמות</h3>
              <button
                onClick={() => setOpen(false)}
                aria-label="סגור"
                className="rounded-md p-1 text-ink-faint hover:text-ink"
              >
                <X className="size-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-2">
              {conversations.length === 0 && (
                <p className="px-3 py-6 text-center text-sm text-ink-faint">
                  עדיין אין שיחות שמורות
                </p>
              )}
              {conversations.map((convo) => (
                <div
                  key={convo.id}
                  className={`group mb-1 flex items-center gap-1 rounded-lg border px-1 transition-colors ${
                    convo.id === active_id
                      ? 'border-accent/40 bg-accent-soft/60'
                      : 'border-transparent hover:bg-accent-soft/40'
                  }`}
                >
                  <button
                    onClick={() => {
                      onSelect(convo.id);
                      setOpen(false);
                    }}
                    className="min-w-0 flex-1 px-2 py-2 text-start"
                  >
                    <span className="block truncate text-sm text-ink-soft">{convo.title}</span>
                    <span className="block text-[11px] text-ink-faint">
                      {relativeTime(convo.updated_at)}
                    </span>
                  </button>
                  {/* Always visible on touch; hover/focus-revealed on pointer devices */}
                  <button
                    onClick={() => onDelete(convo.id)}
                    aria-label={`מחק את "${convo.title}"`}
                    className="rounded-md p-1.5 text-ink-faint transition-opacity hover:text-negative focus-visible:opacity-100 sm:opacity-0 sm:group-hover:opacity-100 [@media(pointer:coarse)]:opacity-100"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </aside>
        </div>,
        document.body
      )}
    </>
  );
}
