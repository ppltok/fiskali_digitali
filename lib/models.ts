import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import type { LanguageModel } from 'ai';

// Free-model chain. Order is provisional until the M0 bake-off ranks them;
// OpenRouter's request-level `models` array handles fallback routing when the
// primary is rate-limited or unavailable.
export const MODEL_CHAIN = [
  'nvidia/nemotron-3-super-120b-a12b:free',
  'google/gemma-4-31b-it:free',
  'openai/gpt-oss-20b:free',
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
