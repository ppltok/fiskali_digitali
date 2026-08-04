// M0 gate: rank free OpenRouter models on Hebrew budget questions with real MCP tools.
// Run: npx tsx scripts/bake_off.ts
// Budget: hard stop at 30 live requests (each agent step = 1 request).
import { generateText, stepCountIs } from 'ai';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { openBudgetSession } from '../lib/budget_mcp';
import { writeFileSync } from 'node:fs';

process.loadEnvFile('.env.local');

const API_KEY = process.env.OPENROUTER_API_KEY;
if (!API_KEY) {
  console.error('OPENROUTER_API_KEY missing — paste it into .env.local first.');
  process.exit(1);
}

const REQUEST_BUDGET = 30;
const MAX_STEPS_PER_QUESTION = 4;
const CANDIDATES = [
  'nvidia/nemotron-3-super-120b-a12b:free',
  'google/gemma-4-31b-it:free',
  'openai/gpt-oss-20b:free',
];

const QUESTIONS = [
  'כמה תקציב הוקצה למשרד החינוך בשנת 2025? ענה בעברית עם המספר המדויק.',
  'מהן חמש העמותות שקיבלו את סכומי התמיכה הגבוהים ביותר מהמדינה ב-2024?',
  'איך השתנה תקציב משרד הביטחון בין 2022 ל-2025? תן מספרים לכל שנה.',
];

const SYSTEM = `אתה עוזר נתונים פיסקליים. יש לך כלים לשאילתות על מסד הנתונים של תקציב מדינת ישראל (מפתח התקציב).
- קרא DatasetInfo לפני שאילתה ראשונה על מאגר.
- השתמש ב-DatasetDBQuery עם SQL (PostgreSQL, SELECT בלבד, תמיד LIMIT).
- ענה תמיד בעברית, ציין שנים וסכומים בש"ח, וציין מאיזה מאגר הגיעו הנתונים.`;

interface RunScore {
  model: string;
  question: string;
  steps: number;
  tool_calls: number;
  latency_ms: number;
  hebrew_ratio: number;
  has_numbers: boolean;
  answer_chars: number;
  error?: string;
  answer_preview: string;
}

let requests_used = 0;

function hebrewRatio(text: string): number {
  const letters = text.replace(/[^A-Za-z֐-׿]/g, '');
  if (!letters.length) return 0;
  const hebrew = letters.replace(/[A-Za-z]/g, '');
  return hebrew.length / letters.length;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const openrouter = createOpenRouter({ apiKey: API_KEY });
  const scores: RunScore[] = [];

  for (const model_id of CANDIDATES) {
    for (const question of QUESTIONS) {
      if (requests_used + MAX_STEPS_PER_QUESTION > REQUEST_BUDGET) {
        console.log(`\n⛔ budget guard: ${requests_used}/${REQUEST_BUDGET} used, stopping.`);
        break;
      }
      const session = await openBudgetSession();
      const t0 = Date.now();
      try {
        const result = await generateText({
          model: openrouter(model_id),
          system: SYSTEM,
          prompt: question,
          tools: session.tools,
          stopWhen: stepCountIs(MAX_STEPS_PER_QUESTION),
        });
        const steps = result.steps.length;
        requests_used += steps;
        const tool_calls = result.steps.reduce((n, s) => n + s.toolCalls.length, 0);
        scores.push({
          model: model_id,
          question: question.slice(0, 40),
          steps,
          tool_calls,
          latency_ms: Date.now() - t0,
          hebrew_ratio: Math.round(hebrewRatio(result.text) * 100) / 100,
          has_numbers: /\d[\d,.]{3,}/.test(result.text),
          answer_chars: result.text.length,
          answer_preview: result.text.slice(0, 400).replace(/\n/g, ' '),
        });
        console.log(
          `✓ ${model_id} | "${question.slice(0, 30)}…" | steps=${steps} tools=${tool_calls} ${Date.now() - t0}ms | used=${requests_used}`
        );
      } catch (e) {
        requests_used += 1; // failed call still counts against quota
        scores.push({
          model: model_id,
          question: question.slice(0, 40),
          steps: 0,
          tool_calls: 0,
          latency_ms: Date.now() - t0,
          hebrew_ratio: 0,
          has_numbers: false,
          answer_chars: 0,
          error: String(e).slice(0, 300),
          answer_preview: '',
        });
        console.log(`✗ ${model_id} | ${String(e).slice(0, 160)}`);
      } finally {
        await session.close();
      }
      await sleep(4000); // stay under 20 req/min
    }
  }

  // Rank: tool use + Hebrew + numeric grounding, latency as tiebreak.
  const by_model = new Map<string, RunScore[]>();
  for (const s of scores) {
    by_model.set(s.model, [...(by_model.get(s.model) ?? []), s]);
  }
  const ranking = [...by_model.entries()]
    .map(([model, runs]) => {
      const ok = runs.filter((r) => !r.error);
      const score =
        ok.length * 10 +
        ok.filter((r) => r.tool_calls > 0).length * 5 +
        ok.filter((r) => r.has_numbers).length * 3 +
        ok.reduce((n, r) => n + r.hebrew_ratio, 0) * 2 -
        ok.reduce((n, r) => n + r.latency_ms, 0) / 60000;
      return { model, score: Math.round(score * 10) / 10, runs: runs.length, failed: runs.length - ok.length };
    })
    .sort((a, b) => b.score - a.score);

  console.log('\n=== RANKING ===');
  ranking.forEach((r, i) => console.log(`${i + 1}. ${r.model} score=${r.score} (failed ${r.failed}/${r.runs})`));
  console.log(`\nrequests used: ${requests_used}/${REQUEST_BUDGET}`);

  writeFileSync('scripts/bake_off_results.json', JSON.stringify({ ranking, scores, requests_used }, null, 2));
  console.log('full transcripts → scripts/bake_off_results.json');
}

main().catch((e) => {
  console.error('FATAL:', e);
  process.exit(1);
});
