import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { getAllMeals, getProfile, saveMeal, saveProfile } from './db';
import { todayKey } from './dates';
import type { Meal, Profile } from './types';

interface BackupFile {
  app: 'bentometer';
  version: 1;
  exportedAt: string;
  profile: Profile | null;
  meals: Meal[];
}

/** Write all data to a JSON file and open the share sheet. Photos are not included. */
export async function exportBackup(): Promise<number> {
  const data: BackupFile = {
    app: 'bentometer',
    version: 1,
    exportedAt: new Date().toISOString(),
    profile: await getProfile(),
    meals: (await getAllMeals()).map((m) => ({ ...m, photoUri: null })),
  };
  const file = new File(Paths.cache, `bentometer-${todayKey()}.json`);
  file.create({ overwrite: true });
  file.write(JSON.stringify(data, null, 2));
  await Sharing.shareAsync(file.uri, { mimeType: 'application/json', dialogTitle: 'Save BentoMeter backup' });
  return data.meals.length;
}

/** Merge meals from a backup file (same ids are overwritten). Returns the number imported, or null if cancelled. */
export async function importBackup(): Promise<number | null> {
  const res = await DocumentPicker.getDocumentAsync({ type: ['application/json', 'text/*', '*/*'], copyToCacheDirectory: true });
  if (res.canceled || !res.assets?.[0]) return null;
  const text = await new File(res.assets[0].uri).text();
  const data = JSON.parse(text) as BackupFile;
  if (data.app !== 'bentometer' || !Array.isArray(data.meals)) throw new Error('This is not a BentoMeter backup file.');
  if (data.profile) await saveProfile(data.profile);
  for (const m of data.meals) await saveMeal({ ...m, photoUri: null });
  return data.meals.length;
}
