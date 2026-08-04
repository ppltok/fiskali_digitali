# פיסקלי דיגיטלי

שיחה חיה עם תקציב מדינת ישראל. שאלו כל שאלה בעברית — וקבלו תשובות מגובות בנתונים
בזמן אמת ממסד הנתונים הפתוח של [מפתח התקציב](https://next.obudget.org), עם תרשימים,
מקורות, ושקיפות מלאה של השאילתות.

**English**: A chat-first Hebrew/RTL web app over Israel's state budget. Ask anything in
plain Hebrew; answers are grounded in live queries against the BudgetKey open-data MCP
server, with on-the-fly charts, source citations, and a "show me the SQL" trust feature.

## Architecture

| Layer | Choice |
|---|---|
| Framework | Next.js 16 (App Router), React 19, Tailwind 4 |
| AI | Vercel AI SDK v7 + OpenRouter **free models** (fallback chain in `lib/models.ts`) |
| Data | BudgetKey MCP (`https://next.obudget.org/mcp`) via `@ai-sdk/mcp`; REST fallback (`DATA_BACKEND=rest`) |
| Generative UI | `display_chart` / `display_table` / `suggest_questions` tools → Recharts + RTL tables + follow-up chips |
| Persistence | localStorage only — no accounts, no database, $0 vendors |
| Hosting | Vercel Hobby (Fluid compute, `maxDuration=300`) |

The chat loop: `useChat` → `POST /api/chat` → per-request MCP session → `streamText`
with data tools + display tools (step cap 6) → UI-message stream. Tool calls render as
live Hebrew progress chips; the model's `display_chart` inputs render as charts.

## Running locally

```bash
npm install
cp .env.example .env.local   # paste your OpenRouter API key
npm run dev
```

- `LLM_MODE=mock` replays `fixtures/mock_conversation.json` — full UI development with
  **zero** LLM requests.
- `scripts/test_mcp.ts` / `scripts/test_rest.ts` — data-layer round-trip tests (no LLM).
- `scripts/bake_off.ts` — ranks free OpenRouter models on Hebrew budget questions
  (budgeted at ≤30 requests).

## The free-quota reality

OpenRouter free models allow **50 requests/day** (1000/day after a one-time $10 credit
purchase). One agentic question costs 4–8 requests. Mitigations built in: 6-step cap,
per-IP soft throttle, honest Hebrew quota banner, and a settings drawer where any
visitor can paste **their own** free OpenRouter key (stored only in their browser,
sent as `x-user-key`).

## Data source

All figures come from [BudgetKey / מפתח התקציב](https://next.obudget.org) (OpenBudget
project) — budget book, supports, contracts, entities, income, budget changes,
government decisions, social services; years 1997–2026. Answers are model-generated:
verify critical numbers at the source.
