import { AppState, TurboModuleRegistry } from 'react-native';
import type { LlamaContext } from 'llama.rn';
import type { AnalyzedMeal } from '../prompt';
import { itemsFromParsed } from './foodDb';
import { LOCAL_SCHEMA, LOCAL_SYSTEM_PROMPT, localUserText, parseLocalReply } from './localPrompt';
import { isModelReady, modelPaths } from './modelManager';
import { LOCAL_MODEL_LABEL } from './models';

/**
 * On-device analysis with llama.rn (llama.cpp). The Pixel 9a's Mali GPU is not supported by
 * llama.rn's OpenCL backend, so everything runs on the CPU; images are capped at 256 tokens to stay fast.
 */

const IDLE_RELEASE_MS = 2 * 60 * 1000;

let contextPromise: Promise<LlamaContext> | null = null;
let idleTimer: ReturnType<typeof setTimeout> | null = null;

/** False in Expo Go, where the native module is not compiled in. */
export function isLocalRuntimeAvailable(): boolean {
  try {
    return TurboModuleRegistry.get('RNLlama') != null;
  } catch {
    return false;
  }
}

async function loadContext(): Promise<LlamaContext> {
  // Loaded lazily so Expo Go (no native module) can still open the app.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { initLlama } = require('llama.rn') as typeof import('llama.rn');
  const paths = modelPaths();
  const ctx = await initLlama({
    model: paths.model,
    n_ctx: 2048,
    n_batch: 512,
    n_gpu_layers: 0,
    use_mlock: false,
    ctx_shift: false, // required for multimodal
  });
  const ok = await ctx.initMultimodal({ path: paths.mmproj, use_gpu: false, image_max_tokens: 256 });
  if (!ok) {
    await ctx.release();
    throw new Error('Could not load the vision part of the on-device model.');
  }
  return ctx;
}

function getContext(): Promise<LlamaContext> {
  if (!contextPromise) {
    contextPromise = loadContext().catch((e) => {
      contextPromise = null;
      throw e;
    });
  }
  return contextPromise;
}

/** Free the ~2 GB the model holds in RAM. */
export async function releaseLocalModel() {
  if (idleTimer) clearTimeout(idleTimer);
  idleTimer = null;
  const p = contextPromise;
  contextPromise = null;
  if (p) await p.then((ctx) => ctx.release()).catch(() => {});
}

function scheduleRelease() {
  if (idleTimer) clearTimeout(idleTimer);
  idleTimer = setTimeout(() => void releaseLocalModel(), IDLE_RELEASE_MS);
}

AppState.addEventListener('change', (state) => {
  if (state === 'background') void releaseLocalModel();
});

export async function analyzeMealLocally(opts: {
  imageUri?: string;
  description?: string;
  note?: string;
  /** Compact mess menu (dish names) when eating at an IIIT-H mess. */
  menu?: string;
}): Promise<AnalyzedMeal> {
  if (!isLocalRuntimeAvailable()) throw new Error('On-device AI needs the development build of the app (not Expo Go).');
  if (!isModelReady()) throw new Error('Download the on-device model in Settings first.');
  if (idleTimer) clearTimeout(idleTimer);
  try {
    const ctx = await getContext();
    const text = localUserText({ hasPhoto: !!opts.imageUri, description: opts.description, note: opts.note, menu: opts.menu });
    const result = await ctx.completion({
      messages: [
        { role: 'system', content: LOCAL_SYSTEM_PROMPT },
        {
          role: 'user',
          content: opts.imageUri
            ? [
                { type: 'image_url', image_url: { url: opts.imageUri } },
                { type: 'text', text },
              ]
            : text,
        },
      ],
      response_format: { type: 'json_schema', json_schema: { strict: true, schema: LOCAL_SCHEMA } },
      enable_thinking: false,
      n_predict: 600,
      temperature: 0.2,
      top_p: 0.9,
    });
    const parsed = parseLocalReply(result.text);
    return {
      dishSummary: parsed.dishSummary,
      items: itemsFromParsed(parsed.items),
      recommendation: null,
      modelUsed: LOCAL_MODEL_LABEL,
    };
  } finally {
    scheduleRelease();
  }
}
