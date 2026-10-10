import { Directory, File, Paths } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { newId } from './dates';

/**
 * Shrink a picked photo for Gemini and keep a copy in the app's document
 * directory (picker URIs live in a cache the OS may clear).
 */
export async function preparePhoto(uri: string): Promise<{ base64: string; savedUri: string }> {
  const context = ImageManipulator.manipulate(uri);
  context.resize({ width: 1024 });
  const rendered = await context.renderAsync();
  const result = await rendered.saveAsync({ format: SaveFormat.JPEG, compress: 0.7, base64: true });

  const dir = new Directory(Paths.document, 'photos');
  dir.create({ idempotent: true, intermediates: true });
  const dest = new File(dir, `${newId()}.jpg`);
  new File(result.uri).copy(dest);

  return { base64: result.base64 ?? '', savedUri: dest.uri };
}

export function deletePhoto(uri: string | null) {
  if (!uri) return;
  try {
    const f = new File(uri);
    if (f.exists) f.delete();
  } catch {
    // Photo already gone; nothing to clean up.
  }
}
