// M2 gate: REST fallback tools against live BudgetKey API.
import { getBudgetRestTools } from '../lib/budget_rest_tools';

async function main() {
  const t0 = Date.now();
  const tools = getBudgetRestTools();
  const opts = { toolCallId: 't', messages: [], context: undefined };
  const q = await (tools.DatasetDBQuery.execute as any)(
    { query: "SELECT code,title,net_allocated FROM raw_budget WHERE year=2025 AND char_length(code)=4 ORDER BY net_allocated DESC NULLS LAST LIMIT 5", page_size: 5 }, opts);
  console.log('DBQuery:', String(q).slice(0, 300));
  const s = await (tools.DatasetFullTextSearch.execute as any)({ dataset: 'budget_items_data', q: 'משרד החינוך' }, opts);
  console.log('Search:', String(s).slice(0, 200));
  const i = await (tools.DatasetInfo.execute as any)({ dataset: 'budget_items_data' }, opts);
  console.log('Info:', String(i).slice(0, 200));
  const ok = String(q).includes('rows') && String(i).includes('rows');
  console.log(`TOTAL ${Date.now() - t0}ms — ${ok ? 'PASS' : 'FAIL'}`);
  if (!ok) process.exit(1);
}
main().catch((e) => { console.error('FAIL:', e); process.exit(1); });
