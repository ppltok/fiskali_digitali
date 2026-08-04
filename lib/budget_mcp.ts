import { createMCPClient } from '@ai-sdk/mcp';
import type { ToolSet } from 'ai';

const MCP_URL = process.env.BUDGET_MCP_URL ?? 'https://next.obudget.org/mcp';

// Free models have limited context — cap tool payloads before they enter it.
const MAX_TOOL_RESULT_CHARS = 10_000;
const TOOL_TIMEOUT_MS = 15_000;

const TRUNCATION_NOTICE =
  '\n\n[הערה: התוצאה נחתכה כי הייתה ארוכה מדי. צמצם את השאילתה עם LIMIT או page_size קטן יותר.]';

export interface BudgetMCPSession {
  tools: ToolSet;
  instructions: string | undefined;
  close: () => Promise<void>;
}

function truncate(value: unknown): unknown {
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  if (text.length <= MAX_TOOL_RESULT_CHARS) return value;
  return text.slice(0, MAX_TOOL_RESULT_CHARS) + TRUNCATION_NOTICE;
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)
    ),
  ]);
}

function wrapTools(tools: ToolSet): ToolSet {
  const wrapped: ToolSet = {};
  for (const [name, tool] of Object.entries(tools)) {
    wrapped[name] = {
      ...tool,
      execute: async (args: unknown, options: unknown) => {
        const result = await withTimeout(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (tool.execute as any)(args, options),
          TOOL_TIMEOUT_MS,
          name
        );
        return truncate(result);
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;
  }
  return wrapped;
}

export async function openBudgetSession(): Promise<BudgetMCPSession> {
  // BudgetKey issues a per-session id at initialize, so sessions can't be
  // resumed from cached metadata — a full handshake costs ~300ms and is the
  // only reliable path.
  const client = await createMCPClient({
    transport: { type: 'http', url: MCP_URL },
    clientName: 'fiskali_digitali',
    maxRetries: 1,
  });

  const tools = await client.tools();

  return {
    tools: wrapTools(tools),
    instructions: client.initializeResult.instructions,
    close: () => client.close(),
  };
}
