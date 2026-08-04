import { notFound } from 'next/navigation';
import ChartRenderer from '@/components/charts/chart_renderer';

// Dev-only visual harness for the generative-UI renderers (M4 gate).
export default function DevCharts() {
  if (process.env.NODE_ENV === 'production') notFound();

  const trend_rows = [
    { year: '2020', defense: 57800000000, education: 60500000000 },
    { year: '2021', defense: 58900000000, education: 63855000000 },
    { year: '2022', defense: 60100000000, education: 68420000000 },
    { year: '2023', defense: 63500000000, education: 72130000000 },
    { year: '2024', defense: 72400000000, education: 76890000000 },
    { year: '2025', defense: 86200000000, education: 83904553000 },
  ];

  return (
    <main className="mx-auto max-w-3xl space-y-6 px-4 py-10">
      <h1 className="font-display text-2xl text-ink">dev: chart variants</h1>

      <ChartRenderer
        input={{
          chart_type: 'line',
          title: 'ביטחון מול חינוך, 2020–2025 (קו, שתי סדרות)',
          x_key: 'year',
          y_keys: ['defense', 'education'],
          y_labels: ['ביטחון', 'חינוך'],
          rows: trend_rows,
          footnote: 'מקור: ספר התקציב',
        }}
      />

      <ChartRenderer
        input={{
          chart_type: 'bar',
          title: 'השוואת משרדים 2025 (עמודות)',
          x_key: 'ministry',
          y_keys: ['amount'],
          y_labels: ['תקציב'],
          rows: [
            { ministry: 'ביטחון', amount: 86200000000 },
            { ministry: 'חינוך', amount: 83904553000 },
            { ministry: 'בריאות', amount: 52100000000 },
            { ministry: 'רווחה', amount: 21800000000 },
          ],
        }}
      />

      <ChartRenderer
        input={{
          chart_type: 'pie',
          title: 'פילוח הכנסות המדינה 2025 (עוגה)',
          x_key: 'source',
          y_keys: ['amount'],
          rows: [
            { source: 'מסים ישירים', amount: 285460000000 },
            { source: 'מסים עקיפים', amount: 196603000000 },
            { source: 'מימון גירעון', amount: 238828699000 },
            { source: 'אחר', amount: 35015000000 },
          ],
          footnote: 'מקור: ספר התקציב, 2025',
        }}
      />

      <h2 className="font-display text-lg text-ink">malformed inputs (must degrade, never crash)</h2>

      {/* numeric strings + junk row → sanitized chart */}
      <ChartRenderer
        input={{
          chart_type: 'bar',
          title: 'ערכים כמחרוזות',
          x_key: 'y',
          y_keys: ['v'],
          rows: [{ y: '2024', v: '1,200,000' }, { y: '2025', v: 'abc' }, null],
        }}
      />

      {/* missing y_keys → table fallback */}
      <ChartRenderer
        input={{
          chart_type: 'bar',
          title: 'חסר y_keys',
          rows: [{ a: 'שורה', b: 12 }],
        }}
      />

      {/* garbage → renders nothing */}
      <ChartRenderer input={{ nonsense: true }} />
      <p className="text-xs text-ink-faint">(מעל שורה זו לא אמור להופיע דבר עבור קלט זבל)</p>
    </main>
  );
}
