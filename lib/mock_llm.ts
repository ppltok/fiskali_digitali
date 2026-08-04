import { createUIMessageStream, createUIMessageStreamResponse } from 'ai';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// LLM_MODE=mock: replay a recorded conversation as a real UI-message stream.
// Zero OpenRouter requests — the whole UI can be developed against this.

interface MockEvent {
  kind: 'tool' | 'text';
  tool_name?: string;
  dynamic?: boolean;
  input?: unknown;
  output?: unknown;
  delay_ms?: number;
  text?: string;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

let fixture_cache: MockEvent[] | null = null;

function loadFixture(): MockEvent[] {
  if (!fixture_cache) {
    const raw = readFileSync(
      join(process.cwd(), 'fixtures', 'mock_conversation.json'),
      'utf-8'
    );
    fixture_cache = JSON.parse(raw) as MockEvent[];
  }
  return fixture_cache;
}

export function mockChatResponse(): Response {
  const events = loadFixture();

  const stream = createUIMessageStream({
    execute: async ({ writer }) => {
      let id = 0;
      for (const event of events) {
        await sleep(event.delay_ms ?? 300);
        if (event.kind === 'tool') {
          const toolCallId = `mock_${id++}`;
          writer.write({
            type: 'tool-input-available',
            toolCallId,
            toolName: event.tool_name!,
            input: event.input ?? {},
            ...(event.dynamic ? { dynamic: true as const } : {}),
          });
          await sleep(600);
          writer.write({
            type: 'tool-output-available',
            toolCallId,
            output: event.output ?? { ok: true },
            ...(event.dynamic ? { dynamic: true as const } : {}),
          });
        } else if (event.kind === 'text' && event.text) {
          const text_id = `mock_text_${id++}`;
          writer.write({ type: 'text-start', id: text_id });
          // Stream word-by-word so the typing feel is real.
          for (const word of event.text.split(/(?<= )/)) {
            writer.write({ type: 'text-delta', id: text_id, delta: word });
            await sleep(18);
          }
          writer.write({ type: 'text-end', id: text_id });
        }
      }
    },
  });

  return createUIMessageStreamResponse({ stream });
}
