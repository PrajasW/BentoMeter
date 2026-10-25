import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const GEMINI_KEY = 'gemini_api_key';
const DINING_KEY = 'dining_api_key';

// SecureStore is native-only; on web fall back to localStorage for development.
async function getSecret(name: string): Promise<string | null> {
  if (Platform.OS === 'web') return globalThis.localStorage?.getItem(name) ?? null;
  return SecureStore.getItemAsync(name);
}

async function setSecret(name: string, value: string): Promise<void> {
  const v = value.trim();
  if (Platform.OS === 'web') {
    if (v) globalThis.localStorage?.setItem(name, v);
    else globalThis.localStorage?.removeItem(name);
    return;
  }
  if (v) await SecureStore.setItemAsync(name, v);
  else await SecureStore.deleteItemAsync(name);
}

export const getApiKey = () => getSecret(GEMINI_KEY);
export const setApiKey = (value: string) => setSecret(GEMINI_KEY, value);

/** dining.iiit.ac.in API key, used to read which mess the user is registered at. */
export const getDiningKey = () => getSecret(DINING_KEY);
export const setDiningKey = (value: string) => setSecret(DINING_KEY, value);
