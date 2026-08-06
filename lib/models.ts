import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import type { LanguageModel } from 'ai';

// Free-tier reality (measured 2026-08-05): Google meters requests PER MODEL PER
// DAY — `gemini-flash-latest` (→3.6-flash) allows only 20/day — while each
// other model carries its own separate bucket. So we never "pick" one model:
// we try them in order and fail over the moment one is exhausted, which makes
// the daily capacity the SUM of every bucket plus OpenRouter's free chain.
//
// Order: highest-quota lite models first (they carry the day), full flash next
// (better reasoning, tiny bucket — saved for when lite is spent), OpenRouter
// last. No health pings: a ping costs a real request from a scarce bucket.
const GOOGLE_CANDIDATES = [
  'gemini-flash-lite-latest',
  'gemini-3.1-flash-lite-preview',
  'gemini-flash-latest',
  'gemini-3-flash-preview',
];

export const MODEL_CHAIN = [
  'openai/gpt-oss-20b:free',
  'google/gemma-4-31b-it:free',
  'nvidia/nemotron-3-super-120b-a12b:free',
];

export interface Candidate {
  model: LanguageModel;
  provider: 'google' | 'openrouter';
  id: string;
}

function openRouterModel(apiKey: string): LanguageModel {
  const openrouter = createOpenRouter({
    apiKey,
    extraBody: { models: MODEL_CHAIN.slice(1) },
  });
  return openrouter(MODEL_CHAIN[0]);
}

/**
 * Ordered candidates to try for one request. The caller streams with the first
 * and moves to the next when a quota/availability error arrives before any
 * output has been produced.
 */
export function buildCandidates(userKey?: string | null): Candidate[] {
  // A visitor's own key is their quota — use it alone, no server fallbacks.
  if (userKey?.trim()) {
    return [
      { model: openRouterModel(userKey.trim()), provider: 'openrouter', id: MODEL_CHAIN[0] },
    ];
  }

  const candidates: Candidate[] = [];

  const google_key = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (google_key) {
    const google = createGoogleGenerativeAI({ apiKey: google_key });
    for (const id of GOOGLE_CANDIDATES) {
      candidates.push({ model: google(id), provider: 'google', id });
    }
  }

  if (process.env.OPENROUTER_API_KEY) {
    candidates.push({
      model: openRouterModel(process.env.OPENROUTER_API_KEY),
      provider: 'openrouter',
      id: MODEL_CHAIN[0],
    });
  }

  return candidates;
}

/** True when the error means "this model is spent/unavailable — try another". */
export function isFailoverError(error: unknown): boolean {
  const err = error as { statusCode?: number; message?: string } | undefined;
  const text = `${err?.message ?? ''} ${String(error)}`.toLowerCase();
  return (
    err?.statusCode === 429 ||
    err?.statusCode === 503 ||
    err?.statusCode === 502 ||
    text.includes('quota') ||
    text.includes('rate limit') ||
    text.includes('resourceexhausted') ||
    text.includes('overloaded') ||
    text.includes('unavailable')
  );
}
