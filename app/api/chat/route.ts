import {
  streamText,
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  stepCountIs,
  type UIMessage,
} from 'ai';
import { openBudgetSession, type BudgetMCPSession } from '@/lib/budget_mcp';
import { getBudgetRestTools } from '@/lib/budget_rest_tools';
import { display_tools } from '@/lib/chart_tool';
import { buildSystemPrompt } from '@/lib/system_prompt';
import { buildCandidates, isFailoverError } from '@/lib/models';
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

  const candidates = buildCandidates(user_key);
  if (!candidates.length) {
    await session?.close();
    return Response.json(
      { error: 'missing_api_key', message: 'חסר מפתח מודל שפה בצד השרת.' },
      { status: 500 }
    );
  }

  const system = buildSystemPrompt(server_instructions);
  const model_messages = await convertToModelMessages(messages);
  const tools = { ...data_tools, ...display_tools };

  const stream = createUIMessageStream({
    execute: async ({ writer }) => {
      let last_error: unknown;

      for (let i = 0; i < candidates.length; i++) {
        const candidate = candidates[i];
        // Nothing has reached the user yet, so this candidate may still be
        // swapped out; once a chunk is written we are committed to it.
        let committed = false;
        const started = Date.now();

        const result = streamText({
          model: candidate.model,
          system,
          messages: model_messages,
          tools,
          // Exhausted daily buckets never recover by retrying — failing over to
          // the next bucket is both faster and cheaper than waiting.
          maxRetries: 1,
          stopWhen: stepCountIs(9),
          onFinish: ({ steps, usage }) => {
            console.log(
              `[chat] ok provider=${candidate.provider} model=${candidate.id} ` +
                `steps=${steps.length} tokens=${usage?.totalTokens ?? '?'} ` +
                `ms=${Date.now() - started}`
            );
          },
        });

        try {
          for await (const chunk of result.toUIMessageStream({ sendStart: i === 0 })) {
            writer.write(chunk);
            committed = true;
          }
          return;
        } catch (error) {
          last_error = error;
          const can_retry = !committed && isFailoverError(error) && i < candidates.length - 1;
          console.error(
            `[chat] ${candidate.provider}/${candidate.id} failed ` +
              `(committed=${committed}, failover=${can_retry}):`,
            error
          );
          if (!can_retry) throw error;
        }
      }

      throw last_error ?? new Error('no_candidates');
    },
    onFinish: async () => {
      await session?.close();
    },
    onError: (error) => {
      const err = error as { message?: string; statusCode?: number };
      const text = `${err?.message ?? ''} ${String(error)}`.toLowerCase();
      if (text.includes('quota') || text.includes('429') || text.includes('rate limit')) {
        return 'כל המכסות החינמיות אזלו לרגע זה. אפשר להוסיף מפתח OpenRouter אישי בהגדרות (חינמי, דקה להפיק) ולהמשיך מיד — או לנסות שוב מאוחר יותר.';
      }
      if (text.includes('unavailable') || text.includes('overloaded') || text.includes('503')) {
        return 'שרתי המודל החינמיים עמוסים כרגע. נסו שוב בעוד רגע.';
      }
      return 'אירעה שגיאה בעיבוד השאלה. נסו לנסח אותה מחדש.';
    },
  });

  return createUIMessageStreamResponse({ stream });
}
