import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import type { LanguageModel } from 'ai';

// Free-tier reality (measured 2026-08-05): Google meters `free_tier_requests`
// PER MODEL PER DAY, and the newest alias (gemini-flash-latest → 3.6-flash)
// allows only 20/day — about two agentic answers. Other models have their own,
// much healthier buckets. So we cascade: ping candidates cheaply, use the first
// live one, and fall through to OpenRouter when every Google bucket is spent.
const GOOGLE_CANDIDATES = [
  'gemini-3-flash-preview',
  'gemini-flash-lite-latest',
  'gemini-flash-latest',
];

export const MODEL_CHAIN = [
  'openai/gpt-oss-20b:free',
  'google/gemma-4-31b-it:free',
  'nvidia/nemotron-3-super-120b-a12b:free',
];

const HEALTH_TTL_MS = 5 * 60 * 1000;
let cached_choice: { model: string | null; at: number } | null = null;

async function isAlive(model: string, apiKey: string): Promise<boolean> {
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
        body: JSON.stringify({
          contents: [{ parts: [{ text: 'ok' }] }],
          generationConfig: { maxOutputTokens: 1 },
        }),
        signal: AbortSignal.timeout(10_000),
      }
    );
    return res.ok;
  } catch {
    return false;
  }
}

async function pickGoogleModel(apiKey: string): Promise<string | null> {
  if (cached_choice && Date.now() - cached_choice.at < HEALTH_TTL_MS) {
    return cached_choice.model;
  }
  for (const model of GOOGLE_CANDIDATES) {
    if (await isAlive(model, apiKey)) {
      cached_choice = { model, at: Date.now() };
      return model;
    }
  }
  cached_choice = { model: null, at: Date.now() };
  return null;
}

/** Call when a stream fails mid-flight so the next request re-probes. */
export function invalidateModelChoice(): void {
  cached_choice = null;
}

function openRouterModel(apiKey: string): LanguageModel {
  const openrouter = createOpenRouter({
    apiKey,
    extraBody: { models: MODEL_CHAIN.slice(1) },
  });
  return openrouter(MODEL_CHAIN[0]);
}

export interface ResolvedModel {
  model: LanguageModel;
  provider: 'google' | 'openrouter';
  id: string;
}

// Priority: visitor's own OpenRouter key > a live Google model > server
// OpenRouter free chain.
export async function resolveModel(userKey?: string | null): Promise<ResolvedModel> {
  if (userKey?.trim()) {
    return { model: openRouterModel(userKey.trim()), provider: 'openrouter', id: MODEL_CHAIN[0] };
  }

  const google_key = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (google_key) {
    const picked = await pickGoogleModel(google_key);
    if (picked) {
      const google = createGoogleGenerativeAI({ apiKey: google_key });
      return { model: google(picked), provider: 'google', id: picked };
    }
  }

  if (process.env.OPENROUTER_API_KEY) {
    return {
      model: openRouterModel(process.env.OPENROUTER_API_KEY),
      provider: 'openrouter',
      id: MODEL_CHAIN[0],
    };
  }

  throw new Error('missing_api_key');
}
