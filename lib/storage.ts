import type { UIMessage } from 'ai';

// localStorage conversation persistence. schema_version guards future shape
// changes — on mismatch we archive-drop rather than crash on stale data.
const SCHEMA_VERSION = 1;
const INDEX_KEY = 'fiskali_conversations_v1';
const CONVO_PREFIX = 'fiskali_convo_';
const MAX_CONVERSATIONS = 30;

export interface ConversationMeta {
  id: string;
  title: string;
  updated_at: number;
}

interface StoredConversation {
  schema_version: number;
  messages: UIMessage[];
}

function safeParse<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function listConversations(): ConversationMeta[] {
  const index = safeParse<ConversationMeta[]>(localStorage.getItem(INDEX_KEY));
  return Array.isArray(index) ? index : [];
}

export function loadConversation(id: string): UIMessage[] | null {
  const stored = safeParse<StoredConversation>(localStorage.getItem(CONVO_PREFIX + id));
  if (!stored || stored.schema_version !== SCHEMA_VERSION) return null;
  return stored.messages;
}

export function saveConversation(id: string, messages: UIMessage[]): void {
  if (!messages.length) return;
  const first_user = messages.find((m) => m.role === 'user');
  const title =
    first_user?.parts
      .filter((p) => p.type === 'text')
      .map((p) => (p as { text: string }).text)
      .join('')
      .slice(0, 60) || 'שיחה חדשה';

  try {
    localStorage.setItem(
      CONVO_PREFIX + id,
      JSON.stringify({ schema_version: SCHEMA_VERSION, messages } satisfies StoredConversation)
    );
    const index = listConversations().filter((c) => c.id !== id);
    index.unshift({ id, title, updated_at: Date.now() });
    // Evict oldest beyond cap — also protects the ~5MB localStorage budget.
    for (const evicted of index.slice(MAX_CONVERSATIONS)) {
      localStorage.removeItem(CONVO_PREFIX + evicted.id);
    }
    localStorage.setItem(INDEX_KEY, JSON.stringify(index.slice(0, MAX_CONVERSATIONS)));
  } catch {
    // Quota exceeded — drop the oldest conversation and give up quietly if it persists.
    const index = listConversations();
    const oldest = index[index.length - 1];
    if (oldest && oldest.id !== id) {
      localStorage.removeItem(CONVO_PREFIX + oldest.id);
      localStorage.setItem(INDEX_KEY, JSON.stringify(index.slice(0, -1)));
    }
  }
}

export function deleteConversation(id: string): void {
  localStorage.removeItem(CONVO_PREFIX + id);
  localStorage.setItem(
    INDEX_KEY,
    JSON.stringify(listConversations().filter((c) => c.id !== id))
  );
}

const USER_KEY_KEY = 'fiskali_user_openrouter_key';

export function getUserKey(): string {
  return localStorage.getItem(USER_KEY_KEY) ?? '';
}

export function setUserKey(key: string): void {
  if (key.trim()) localStorage.setItem(USER_KEY_KEY, key.trim());
  else localStorage.removeItem(USER_KEY_KEY);
}
