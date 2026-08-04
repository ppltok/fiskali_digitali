// M2 gate test: MCP round-trip against the live BudgetKey server, no LLM involved.
// Run: npx tsx scripts/test_mcp.ts
import { openBudgetSession } from '../lib/budget_mcp';

async function main() {
  const t0 = Date.now();
  const session = await openBudgetSession();
  const t_connect = Date.now() - t0;

  console.log(`connected in ${t_connect}ms`);
  console.log('tools:', Object.keys(session.tools).join(', '));
  console.log(
    'server instructions:',
    session.instructions ? `${session.instructions.length} chars` : 'none'
  );

  const db_query = session.tools['DatasetDBQuery'];
  if (!db_query?.execute) throw new Error('DatasetDBQuery tool missing');

  const t1 = Date.now();
  const result = await db_query.execute(
    {
      dataset: 'budget_items_data',
      query:
        "SELECT code, title, net_allocated FROM raw_budget WHERE year=2025 AND char_length(code)=4 ORDER BY net_allocated DESC NULLS LAST LIMIT 5",
      page_size: 5,
    },
    { toolCallId: 'test', messages: [], context: undefined }
  );
  const t_query = Date.now() - t1;

  const text = typeof result === 'string' ? result : JSON.stringify(result);
  console.log(`query in ${t_query}ms, result ${text.length} chars (cap 10000+notice)`);
  console.log(text.slice(0, 600));

  // Truncation check: a fat query must come back capped.
  const t2 = Date.now();
  const fat = await db_query.execute(
    {
      dataset: 'budget_items_data',
      query: 'SELECT * FROM raw_budget WHERE year=2025 LIMIT 500',
      page_size: 500,
    },
    { toolCallId: 'test2', messages: [], context: undefined }
  );
  const fat_text = typeof fat === 'string' ? fat : JSON.stringify(fat);
  console.log(
    `fat query in ${Date.now() - t2}ms → ${fat_text.length} chars, truncated: ${fat_text.includes('נחתכה')}`
  );

  // Second-session check: fresh handshakes must stay cheap.
  const t3 = Date.now();
  const session2 = await openBudgetSession();
  console.log(`second connect in ${Date.now() - t3}ms`);

  await session2.close();
  await session.close();

  const total = Date.now() - t0;
  console.log(`TOTAL ${total}ms — bar: <10000ms → ${total < 10000 ? 'PASS' : 'FAIL'}`);
  if (total >= 10000 || !fat_text.includes('נחתכה') || text.length < 50) process.exit(1);
}

main().catch((e) => {
  console.error('FAIL:', e);
  process.exit(1);
});
