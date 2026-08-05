import {
  streamText,
  convertToModelMessages,
  stepCountIs,
  type UIMessage,
} from 'ai';
import { openBudgetSession, type BudgetMCPSession } from '@/lib/budget_mcp';
import { getBudgetRestTools } from '@/lib/budget_rest_tools';
import { display_tools } from '@/lib/chart_tool';
import { buildSystemPrompt } from '@/lib/system_prompt';
import { resolveModel } from '@/lib/models';
import { mockChatResponse } from '@/lib/mock_llm';

export const maxDuration = 300;

// Best-effort per-instance throttle (serverless memory is per-instance — this
// is a speed bump, not a wall; the real protection is the OpenRouter quota).
const ip_hits = new Map<string, { count: number; window_start: number }>();
const IP_WINDOW_MS = 60_000;
const IP_MAX_PER_WINDOW = 6;

function throttled(ip: string): boolean {
  const now = Date.now();
  const entry = ip_hits.get(ip);
  if (!entry || now - entry.window_start > IP_WINDOW_MS) {
    ip_hits.set(ip, { count: 1, window_start: now });
    return false;
  }
  entry.count += 1;
  return entry.count > IP_MAX_PER_WINDOW;
}

export async function POST(req: Request) {
  if (process.env.LLM_MODE === 'mock') {
    return mockChatResponse();
  }

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  const user_key = req.headers.get('x-user-key');

  if (!user_key && throttled(ip)) {
    return Response.json(
      { error: 'rate_limited', message: 'יותר מדי שאלות בדקה האחרונה. נסו שוב עוד רגע.' },
      { status: 429 }
    );
  }

  const { messages }: { messages: UIMessage[] } = await req.json();

  let session: BudgetMCPSession | null = null;
  let data_tools;
  let server_instructions: string | undefined;

  if (process.env.DATA_BACKEND === 'rest') {
    data_tools = getBudgetRestTools();
  } else {
    try {
      session = await openBudgetSession();
      data_tools = session.tools;
      server_instructions = session.instructions;
    } catch {
      // MCP down — degrade to the REST backend transparently.
      data_tools = getBudgetRestTools();
    }
  }

  let model;
  try {
    model = resolveModel(user_key);
  } catch {
    await session?.close();
    return Response.json(
      { error: 'missing_api_key', message: 'חסר מפתח OpenRouter בצד השרת.' },
      { status: 500 }
    );
  }

  const result = streamText({
    model,
    system: buildSystemPrompt(server_instructions),
    messages: await convertToModelMessages(messages),
    tools: { ...data_tools, ...display_tools },
    // Gemini free tier = 20 requests/min and one agentic answer makes up to 9
    // calls. Exponential backoff across 6 retries (~2min span) rides out the
    // per-minute window instead of failing the stream after 3 fast attempts.
    maxRetries: 6,
    // Gemini routinely uses 6-8 legitimate steps on trend questions
    // (schema → search → several queries → chart → follow-ups).
    stopWhen: stepCountIs(9),
    onFinish: async () => {
      await session?.close();
    },
    onError: async ({ error }) => {
      console.error('[chat] streamText error:', error);
      await session?.close();
    },
  });

  return result.toUIMessageStreamResponse({
    onError: (error) => {
      console.error('[chat] stream error:', error);
      const err = error as { message?: string; code?: number; metadata?: { error_type?: string } };
      const text = err?.message ?? String(error);
      if (
        err?.code === 502 ||
        err?.metadata?.error_type === 'provider_unavailable' ||
        text.includes('ResourceExhausted')
      ) {
        return 'השרתים החינמיים של מודל השפה עמוסים כרגע — זה קורה בשעות שיא. נסו שוב בעוד דקה-שתיים.';
      }
      if (text.includes('429') || text.toLowerCase().includes('rate') || text.toLowerCase().includes('quota')) {
        return 'יש כרגע יותר מדי שאלות בו-זמנית מול המכסה החינמית — המתינו כדקה ונסו שוב. אם זה חוזר שוב ושוב, אפשר להוסיף מפתח OpenRouter אישי בהגדרות.';
      }
      return 'אירעה שגיאה בעיבוד השאלה. נסו לנסח אותה מחדש.';
    },
  });
}
