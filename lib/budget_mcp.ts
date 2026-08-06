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

interface MCPContentPart {
  type?: string;
  text?: string;
}

// MCP tool results must keep their CallToolResult shape ({content: [...]}) —
// the SDK checks `'content' in result`. Truncate inside the text parts.
function truncate(value: unknown): unknown {
  if (
    value &&
    typeof value === 'object' &&
    Array.isArray((value as { content?: unknown }).content)
  ) {
    const v = value as { content: MCPContentPart[]; structuredContent?: unknown };
    const capped = {
      ...v,
      content: v.content.map((part) =>
        part?.type === 'text' &&
        typeof part.text === 'string' &&
        part.text.length > MAX_TOOL_RESULT_CHARS
          ? { ...part, text: part.text.slice(0, MAX_TOOL_RESULT_CHARS) + TRUNCATION_NOTICE }
          : part
      ),
    };
    // structuredContent duplicates the payload uncapped — drop it when large.
    if (
      capped.structuredContent !== undefined &&
      JSON.stringify(capped.structuredContent).length > MAX_TOOL_RESULT_CHARS
    ) {
      delete capped.structuredContent;
    }
    return capped;
  }
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

// Verified 2026-08-05 by querying each table through the MCP server. Models
// routinely write `FROM budget_items_data` (the dataset name) instead of the
// real table — BudgetKey answers that with 0 rows and no error, so the model
// burns its whole step budget guessing. Rewriting it is deterministic and
// saves several model calls per question.
const DATASET_TO_TABLE: Record<string, string> = {
  budget_items_data: 'raw_budget',
  income_items_data: 'raw_income',
  support_programs_data: 'supports_data',
  supports_transactions_data: 'raw_supports',
  contracts_data: 'contract_spending',
  entities_data: 'entities',
  budgetary_change_transactions_data: 'raw_budget_changes',
  government_decisions_data: 'government_decisions',
  social_services_data: 'activities',
};

function fixTableNames(query: string): string {
  let fixed = query;
  for (const [dataset, table] of Object.entries(DATASET_TO_TABLE)) {
    fixed = fixed.replace(
      new RegExp(`(\\b(?:FROM|JOIN)\\s+)${dataset}\\b`, 'gi'),
      `$1${table}`
    );
  }
  // `item_url` doesn't exist on raw_budget, and BudgetKey answers unknown
  // columns with 0 rows instead of an error — models then loop until their
  // step budget is gone. Drop it from the projection.
  if (/\bitem_url\b/i.test(fixed) && /\braw_budget\b/i.test(fixed)) {
    fixed = fixed
      .replace(/,\s*item_url\b/gi, '')
      .replace(/\bitem_url\s*,\s*/gi, '')
      .replace(/SELECT\s+item_url\s+FROM/gi, 'SELECT code, title FROM');
  }
  return fixed;
}

const EMPTY_RESULT_HINT =
  '\n\n[רמז: 0 שורות. בדוק שכל העמודות קיימות (ב-raw_budget אין item_url), ' +
  'ושרמת הקוד נכונה — char_length(code)=4 היא רמת המשרד/סעיף. ' +
  'אם ניסית פעמיים, עבור ל-DatasetFullTextSearch כדי לאתר את הקוד.]';

function addEmptyHint(value: unknown): unknown {
  try {
    const v = value as { content?: Array<{ type?: string; text?: string }> };
    if (!Array.isArray(v?.content)) return value;
    const empty = v.content.some(
      (p) => p?.type === 'text' && typeof p.text === 'string' && /"num_rows":\s*0\b/.test(p.text)
    );
    if (!empty) return value;
    return {
      ...v,
      content: v.content.map((p) =>
        p?.type === 'text' && typeof p.text === 'string'
          ? { ...p, text: p.text + EMPTY_RESULT_HINT }
          : p
      ),
    };
  } catch {
    return value;
  }
}

function wrapTools(tools: ToolSet): ToolSet {
  const wrapped: ToolSet = {};
  for (const [name, tool] of Object.entries(tools)) {
    wrapped[name] = {
      ...tool,
      execute: async (args: unknown, options: unknown) => {
        if (
          name === 'DatasetDBQuery' &&
          args &&
          typeof args === 'object' &&
          typeof (args as { query?: unknown }).query === 'string'
        ) {
          const original = (args as { query: string }).query;
          const corrected = fixTableNames(original);
          if (corrected !== original) {
            console.log('[mcp] rewrote dataset name to real table in SQL');
            args = { ...(args as object), query: corrected };
          }
        }
        const result = await withTimeout(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (tool.execute as any)(args, options),
          TOOL_TIMEOUT_MS,
          name
        );
        return addEmptyHint(truncate(result));
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
