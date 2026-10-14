import type { AnalyzedMeal } from '../prompt';

/** llama.rn is native-only; on web the on-device engine is simply unavailable. */

export function isLocalRuntimeAvailable(): boolean {
  return false;
}

export async function releaseLocalModel() {}

export async function analyzeMealLocally(_opts: { imageUri?: string; description?: string; note?: string }): Promise<AnalyzedMeal> {
  throw new Error('On-device AI is only available in the Android/iOS app.');
}
