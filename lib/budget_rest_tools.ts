import { tool, type ToolSet } from 'ai';
import { z } from 'zod';

// Plan-B data backend: the same three capabilities as the BudgetKey MCP server,
// implemented directly over the public REST API. Activated with DATA_BACKEND=rest.
const API_BASE = 'https://next.obudget.org';
const MAX_RESULT_CHARS = 10_000;

const TRUNCATION_NOTICE =
  '\n\n[הערה: התוצאה נחתכה כי הייתה ארוכה מדי. צמצם את השאילתה עם LIMIT קטן יותר.]';

const DATASET_TABLES: Record<string, string> = {
  budget_items_data: 'raw_budget',
  income_items_data: 'raw_income',
  support_programs_data: 'supports_data',
  supports_transactions_data: 'raw_supports',
  contracts_data: 'contract_spending',
  entities_data: 'entities_data',
  budgetary_change_requests_data: 'budget_changes_data',
  budgetary_change_transactions_data: 'raw_budget_changes',
  government_decisions_data: 'gov_decisions_data',
  social_services_data: 'activities',
};

function cap(text: string): string {
  return text.length <= MAX_RESULT_CHARS
    ? text
    : text.slice(0, MAX_RESULT_CHARS) + TRUNCATION_NOTICE;
}

async function apiQuery(sql: string, page_size: number): Promise<string> {
  const url = `${API_BASE}/api/query?query=${encodeURIComponent(sql)}&page_size=${page_size}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
  if (!res.ok) {
    return `שגיאה מהשרת (${res.status}): ${cap(await res.text())}`;
  }
  const data = await res.json();
  return cap(JSON.stringify({ total: data.total, rows: data.rows }));
}

export function getBudgetRestTools(): ToolSet {
  return {
    DatasetInfo: tool({
      description:
        'Get schema and sample values for a BudgetKey dataset. Call this before querying a dataset for the first time. Datasets: ' +
        Object.keys(DATASET_TABLES).join(', '),
      inputSchema: z.object({
        dataset: z.enum(Object.keys(DATASET_TABLES) as [string, ...string[]]),
      }),
      execute: async ({ dataset }) => {
        const table = DATASET_TABLES[dataset];
        return apiQuery(`SELECT * FROM ${table} LIMIT 3`, 3);
      },
    }),
    DatasetFullTextSearch: tool({
      description:
        'Free-text search inside a BudgetKey dataset to locate entities, budget codes, or program names before running precise SQL.',
      inputSchema: z.object({
        dataset: z.enum(Object.keys(DATASET_TABLES) as [string, ...string[]]),
        q: z.string().describe('Search phrase, Hebrew or English'),
      }),
      execute: async ({ dataset, q }) => {
        const kind = dataset === 'entities_data' ? 'entities' : 'budget';
        const url = `${API_BASE}/search/${kind}?q=${encodeURIComponent(q)}&size=10`;
        const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
        if (!res.ok) return `שגיאה מהשרת (${res.status})`;
        return cap(JSON.stringify(await res.json()));
      },
    }),
    DatasetDBQuery: tool({
      description:
        'Run a read-only PostgreSQL SELECT query against a BudgetKey dataset table. Always use LIMIT. Tables: ' +
        Object.entries(DATASET_TABLES)
          .map(([d, t]) => `${d}→${t}`)
          .join(', '),
      inputSchema: z.object({
        query: z.string().describe('A single SELECT statement with LIMIT'),
        page_size: z.number().int().min(1).max(100).default(30),
      }),
      execute: async ({ query, page_size }) => apiQuery(query, page_size),
    }),
  };
}
