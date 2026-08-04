import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import type { LanguageModel } from 'ai';

// Free-model chain, ranked by the M0 bake-off (2026-08-04):
// gpt-oss-20b was the only model that reliably completed Hebrew questions with
// real MCP tool calls (39-118s). gemma-4 was upstream-rate-limited during the
// bake-off (kept as fallback); nemotron answered but took ~10 minutes (last
// resort only). OpenRouter's request-level `models` array handles fallback.
export const MODEL_CHAIN = [
  'openai/gpt-oss-20b:free',
  'google/gemma-4-31b-it:free',
  'nvidia/nemotron-3-super-120b-a12b:free',
  // Deliberately NOT including 'openrouter/free': its auto-routing can land on
  // models without tool support, which answer from memory in broken language —
  // for a data-grounded product an honest error beats a hallucinated answer.
];

export function resolveModel(userKey?: string | null): LanguageModel {
  const apiKey = userKey?.trim() || process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error('missing_api_key');
  }
  const openrouter = createOpenRouter({
    apiKey,
    extraBody: { models: MODEL_CHAIN.slice(1) },
  });
  return openrouter(MODEL_CHAIN[0]);
}
