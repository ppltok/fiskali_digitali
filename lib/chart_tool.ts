import { tool } from 'ai';
import { z } from 'zod';

// Generative-UI tools: the server execute is a no-op — the *input* the model
// writes is what the client renders as a Recharts chart / RTL table.

export const chart_row_schema = z.record(z.string(), z.union([z.string(), z.number()]));

export const chart_input_schema = z.object({
  chart_type: z.enum(['bar', 'line', 'pie']),
  title: z.string().describe('Chart title in Hebrew'),
  x_key: z.string().describe('Key in rows holding the category/x value (e.g. "year")'),
  y_keys: z
    .array(z.string())
    .min(1)
    .max(4)
    .describe('Keys in rows holding numeric series values'),
  y_labels: z
    .array(z.string())
    .optional()
    .describe('Hebrew display labels matching y_keys order'),
  rows: z.array(chart_row_schema).min(1).max(50),
  footnote: z.string().optional().describe('Source note in Hebrew, e.g. "מקור: ספר התקציב, 2025"'),
});

export const table_input_schema = z.object({
  title: z.string().describe('Table title in Hebrew'),
  columns: z.array(
    z.object({
      key: z.string(),
      label: z.string().describe('Hebrew column header'),
      is_currency: z.boolean().optional().describe('Format as ₪ amounts'),
    })
  ),
  rows: z.array(chart_row_schema).min(1).max(50),
  footnote: z.string().optional(),
});

export type ChartInput = z.infer<typeof chart_input_schema>;
export type TableInput = z.infer<typeof table_input_schema>;

export const followups_input_schema = z.object({
  questions: z.array(z.string()).min(1).max(4).describe('Short Hebrew follow-up questions'),
});

export type FollowupsInput = z.infer<typeof followups_input_schema>;

export const display_tools = {
  suggest_questions: tool({
    description:
      'Offer the user 2-3 short follow-up questions as tappable chips. Call this at the END of every answer instead of writing the questions as text.',
    inputSchema: followups_input_schema,
    execute: async () => ({ ok: true }),
  }),
  display_chart: tool({
    description:
      'Render an interactive chart to the user. Use for trends (line), comparisons (bar), or breakdowns (pie). Numbers stay raw — the UI formats ₪.',
    inputSchema: chart_input_schema,
    execute: async () => ({ ok: true }),
  }),
  display_table: tool({
    description:
      'Render a formatted RTL data table to the user. Use for ranked lists and detailed rows instead of markdown tables.',
    inputSchema: table_input_schema,
    execute: async () => ({ ok: true }),
  }),
};
