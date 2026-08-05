import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { google } from '@ai-sdk/google';
import type { LanguageModel } from 'ai';

// Provider strategy ($0 everywhere):
// 1. Visitor-supplied OpenRouter key (x-user-key header) → OpenRouter, their quota.
// 2. Server Google AI Studio key → Gemini Flash. Much higher free daily limits
//    than OpenRouter's 50/day, and a stronger Hebrew tool-caller.
// 3. Server OpenRouter key → free-model chain ranked by the M0 bake-off
//    (2026-08-04): gpt-oss-20b was the only reliable free tool-caller
//    (39-118s); gemma-4 was upstream-rate-limited (fallback); nemotron
//    answered but took ~10min (last resort). No 'openrouter/free' auto-router:
//    it can land on tool-less models that hallucinate in broken language.
// 'gemini-flash-latest' — alias for the current recommended Flash generation.
// (Named models like gemini-2.5-flash are closed to newly created accounts.)
export const GEMINI_MODEL = 'gemini-flash-latest';

export const MODEL_CHAIN = [
  'openai/gpt-oss-20b:free',
  'google/gemma-4-31b-it:free',
  'nvidia/nemotron-3-super-120b-a12b:free',
];

export function resolveModel(userKey?: string | null): LanguageModel {
  if (userKey?.trim()) {
    const openrouter = createOpenRouter({
      apiKey: userKey.trim(),
      extraBody: { models: MODEL_CHAIN.slice(1) },
    });
    return openrouter(MODEL_CHAIN[0]);
  }

  if (process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
    return google(GEMINI_MODEL);
  }

  if (process.env.OPENROUTER_API_KEY) {
    const openrouter = createOpenRouter({
      apiKey: process.env.OPENROUTER_API_KEY,
      extraBody: { models: MODEL_CHAIN.slice(1) },
    });
    return openrouter(MODEL_CHAIN[0]);
  }

  throw new Error('missing_api_key');
}
