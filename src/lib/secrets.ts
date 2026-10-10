import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const KEY = 'gemini_api_key';

// SecureStore is native-only; on web fall back to localStorage for development.
export async function getApiKey(): Promise<string | null> {
  if (Platform.OS === 'web') return globalThis.localStorage?.getItem(KEY) ?? null;
  return SecureStore.getItemAsync(KEY);
}

export async function setApiKey(value: string): Promise<void> {
  const v = value.trim();
  if (Platform.OS === 'web') {
    if (v) globalThis.localStorage?.setItem(KEY, v);
    else globalThis.localStorage?.removeItem(KEY);
    return;
  }
  if (v) await SecureStore.setItemAsync(KEY, v);
  else await SecureStore.deleteItemAsync(KEY);
}
