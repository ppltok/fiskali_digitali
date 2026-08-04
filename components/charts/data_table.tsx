'use client';

import { formatShekels, formatNumber } from '@/lib/format';

interface Column {
  key: string;
  label: string;
  is_currency?: boolean;
}

export default function DataTable({
  title,
  columns,
  rows,
  footnote,
}: {
  title?: string;
  columns: Column[];
  rows: Array<Record<string, string | number>>;
  footnote?: string;
}) {
  return (
    <div className="my-3 overflow-hidden rounded-xl border border-hairline bg-surface">
      {title && (
        <h4 className="border-b border-hairline px-4 py-2.5 font-display text-sm text-ink">
          {title}
        </h4>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-hairline text-xs text-ink-faint">
              {columns.map((col) => (
                <th key={col.key} className="px-4 py-2 text-start font-medium">
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr
                key={i}
                className="border-b border-hairline/50 last:border-0 hover:bg-accent-soft/40"
              >
                {columns.map((col) => {
                  const value = row[col.key];
                  const numeric = typeof value === 'number';
                  return (
                    <td
                      key={col.key}
                      className={`px-4 py-2 ${numeric ? 'figure text-start' : 'text-start'}`}
                    >
                      {numeric
                        ? col.is_currency
                          ? formatShekels(value)
                          : formatNumber(value)
                        : String(value ?? '')}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {footnote && (
        <p className="border-t border-hairline px-4 py-2 text-xs text-ink-faint">{footnote}</p>
      )}
    </div>
  );
}
