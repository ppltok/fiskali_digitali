'use client';

import { useMemo, useState } from 'react';
import { Table2, ChartColumn } from 'lucide-react';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { formatShekels, formatCompact } from '@/lib/format';
import DataTable from './data_table';
import type { ChartInput } from '@/lib/chart_tool';

const SERIES_COLORS = [
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-4)',
  'var(--chart-5)',
];

interface TooltipEntry {
  name?: string;
  value?: number | string;
  color?: string;
}

function FiscalTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: TooltipEntry[];
  label?: string | number;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div
      dir="rtl"
      className="rounded-lg border border-hairline bg-surface-raised px-3 py-2 text-xs shadow-lg"
    >
      <p className="mb-1 font-medium text-ink">{label}</p>
      {payload.map((entry, i) => (
        <p key={i} className="flex items-center gap-1.5 text-ink-soft">
          <span
            className="inline-block size-2 rounded-full"
            style={{ background: entry.color }}
          />
          {entry.name}:{' '}
          <span className="figure font-medium text-ink">
            {typeof entry.value === 'number' ? formatShekels(entry.value) : entry.value}
          </span>
        </p>
      ))}
    </div>
  );
}

// Defensive parse: the model wrote this input — never trust it blindly.
function sanitize(input: unknown): ChartInput | null {
  try {
    const c = input as ChartInput;
    if (!c || !Array.isArray(c.rows) || !c.rows.length) return null;
    if (!c.x_key || !Array.isArray(c.y_keys) || !c.y_keys.length) return null;
    const rows = c.rows
      .filter((r) => r && typeof r === 'object')
      .slice(0, 50)
      .map((r) => {
        const clean: Record<string, string | number> = {};
        for (const [k, v] of Object.entries(r)) {
          clean[k] = typeof v === 'number' ? v : String(v ?? '');
        }
        // y values must be numeric — coerce numeric strings, else drop later
        for (const yk of c.y_keys) {
          const v = clean[yk];
          if (typeof v === 'string') {
            const n = Number(v.replace(/[^\d.-]/g, ''));
            if (Number.isFinite(n)) clean[yk] = n;
          }
        }
        return clean;
      })
      .filter((r) => c.y_keys.some((yk) => typeof r[yk] === 'number'));
    if (!rows.length) return null;
    return { ...c, rows, y_keys: c.y_keys.slice(0, 4) };
  } catch {
    return null;
  }
}

export default function ChartRenderer({ input }: { input: unknown }) {
  const [as_table, setAsTable] = useState(false);
  const chart = useMemo(() => sanitize(input), [input]);

  if (!chart) {
    // Malformed spec: degrade to a table if rows exist at all, else render nothing.
    const rows = (input as ChartInput)?.rows;
    if (Array.isArray(rows) && rows.length) {
      const keys = Object.keys(rows[0] ?? {});
      return (
        <DataTable
          columns={keys.map((k) => ({ key: k, label: k }))}
          rows={rows.slice(0, 50)}
        />
      );
    }
    return null;
  }

  const labels = chart.y_keys.map((k, i) => chart.y_labels?.[i] ?? k);
  const multi_series = chart.y_keys.length > 1;
  const table_columns = [
    { key: chart.x_key, label: '' },
    ...chart.y_keys.map((k, i) => ({ key: k, label: labels[i], is_currency: true })),
  ];

  return (
    <figure className="rise-in my-3 overflow-hidden rounded-xl border border-hairline bg-surface">
      <div className="flex items-center justify-between gap-2 border-b border-hairline px-4 py-2.5">
        <figcaption className="font-display text-sm text-ink">{chart.title}</figcaption>
        <button
          onClick={() => setAsTable((v) => !v)}
          className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-ink-faint transition-colors hover:bg-accent-soft hover:text-accent-strong"
          aria-label={as_table ? 'הצג כתרשים' : 'הצג כטבלה'}
        >
          {as_table ? <ChartColumn className="size-3.5" /> : <Table2 className="size-3.5" />}
          {as_table ? 'תרשים' : 'טבלה'}
        </button>
      </div>

      {as_table ? (
        <div className="[&>div]:my-0 [&>div]:rounded-none [&>div]:border-0">
          <DataTable columns={table_columns} rows={chart.rows} />
        </div>
      ) : (
        <div dir="ltr" className="px-2 pt-4">
          <ResponsiveContainer width="100%" height={280}>
            {chart.chart_type === 'line' ? (
              <LineChart data={chart.rows} margin={{ top: 6, right: 12, left: 12, bottom: 4 }}>
                <CartesianGrid stroke="var(--hairline)" strokeDasharray="0" vertical={false} />
                <XAxis
                  dataKey={chart.x_key}
                  tick={{ fill: 'var(--ink-faint)', fontSize: 11 }}
                  axisLine={{ stroke: 'var(--hairline-strong)' }}
                  tickLine={false}
                />
                <YAxis
                  tickFormatter={formatCompact}
                  tick={{ fill: 'var(--ink-faint)', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  width={70}
                />
                <Tooltip content={<FiscalTooltip />} />
                {multi_series && (
                  <Legend
                    formatter={(v) => <span style={{ color: 'var(--ink-soft)', fontSize: 12 }}>{v}</span>}
                  />
                )}
                {chart.y_keys.map((key, i) => (
                  <Line
                    key={key}
                    dataKey={key}
                    name={labels[i]}
                    stroke={SERIES_COLORS[i]}
                    strokeWidth={2}
                    dot={{ r: 4, fill: SERIES_COLORS[i], strokeWidth: 2, stroke: 'var(--surface)' }}
                    activeDot={{ r: 5 }}
                  />
                ))}
              </LineChart>
            ) : chart.chart_type === 'pie' ? (
              <PieChart margin={{ top: 8, bottom: 8 }}>
                <Tooltip content={<FiscalTooltip />} />
                <Legend
                  formatter={(v) => <span style={{ color: 'var(--ink-soft)', fontSize: 12 }}>{v}</span>}
                />
                <Pie
                  data={chart.rows}
                  dataKey={chart.y_keys[0]}
                  nameKey={chart.x_key}
                  innerRadius="45%"
                  outerRadius="80%"
                  paddingAngle={2}
                  stroke="var(--surface)"
                  strokeWidth={2}
                >
                  {chart.rows.map((_, i) => (
                    <Cell key={i} fill={SERIES_COLORS[i % SERIES_COLORS.length]} />
                  ))}
                </Pie>
              </PieChart>
            ) : (
              <BarChart data={chart.rows} margin={{ top: 6, right: 12, left: 12, bottom: 4 }} barCategoryGap="25%">
                <CartesianGrid stroke="var(--hairline)" strokeDasharray="0" vertical={false} />
                <XAxis
                  dataKey={chart.x_key}
                  tick={{ fill: 'var(--ink-faint)', fontSize: 11 }}
                  axisLine={{ stroke: 'var(--hairline-strong)' }}
                  tickLine={false}
                />
                <YAxis
                  tickFormatter={formatCompact}
                  tick={{ fill: 'var(--ink-faint)', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  width={70}
                />
                <Tooltip content={<FiscalTooltip />} cursor={{ fill: 'var(--accent-soft)', opacity: 0.4 }} />
                {multi_series && (
                  <Legend
                    formatter={(v) => <span style={{ color: 'var(--ink-soft)', fontSize: 12 }}>{v}</span>}
                  />
                )}
                {chart.y_keys.map((key, i) => (
                  <Bar
                    key={key}
                    dataKey={key}
                    name={labels[i]}
                    fill={SERIES_COLORS[i]}
                    radius={[4, 4, 0, 0]}
                    maxBarSize={44}
                  />
                ))}
              </BarChart>
            )}
          </ResponsiveContainer>
        </div>
      )}

      {chart.footnote && (
        <p className="border-t border-hairline px-4 py-2 text-xs text-ink-faint">
          {chart.footnote}
        </p>
      )}
    </figure>
  );
}
