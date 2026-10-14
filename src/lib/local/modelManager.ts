import { Directory, File, Paths, type DownloadTask } from 'expo-file-system';
import { LOCAL_MODEL, LOCAL_MODEL_BYTES, type ModelFile } from './models';

/** Downloads the on-device model once into app storage (it is ~1.5 GB, so it is never bundled in the APK). */

export type ModelStatus =
  | { state: 'none' }
  | { state: 'downloading'; progress: number }
  | { state: 'ready' }
  | { state: 'error'; message: string };

function modelDir(): Directory {
  const dir = new Directory(Paths.document, 'models');
  dir.create({ idempotent: true, intermediates: true });
  return dir;
}

function fileFor(f: ModelFile): File {
  return new File(modelDir(), f.name);
}

const FILES = [LOCAL_MODEL.model, LOCAL_MODEL.mmproj];

const isComplete = (f: ModelFile) => {
  const file = fileFor(f);
  return file.exists && file.size === f.bytes;
};

export function isModelReady(): boolean {
  try {
    return FILES.every(isComplete);
  } catch {
    return false;
  }
}

/** Native paths for llama.rn (it expects plain paths, not file:// URIs). */
export function modelPaths(): { model: string; mmproj: string } {
  const strip = (uri: string) => decodeURIComponent(uri.replace(/^file:\/\//, ''));
  return { model: strip(fileFor(LOCAL_MODEL.model).uri), mmproj: strip(fileFor(LOCAL_MODEL.mmproj).uri) };
}

let active: DownloadTask | null = null;
let cancelled = false;

/** Downloads whatever is missing; resolves when both files are complete. */
export async function downloadModel(onProgress: (fraction: number) => void): Promise<void> {
  if (active) throw new Error('A download is already running.');
  const missing = FILES.filter((f) => !isComplete(f));
  const missingBytes = missing.reduce((n, f) => n + f.bytes, 0);
  if (missingBytes > 0 && Paths.availableDiskSpace < missingBytes + 200 * 1024 * 1024) {
    throw new Error(`Not enough free space — about ${Math.ceil(missingBytes / 1e9 + 0.2)} GB is needed.`);
  }
  cancelled = false;
  let doneBytes = LOCAL_MODEL_BYTES - missingBytes;
  onProgress(doneBytes / LOCAL_MODEL_BYTES);
  for (const f of missing) {
    const file = fileFor(f);
    if (file.exists) file.delete(); // partial leftover from an interrupted download
    const base = doneBytes;
    active = File.createDownloadTask(f.url, file, {
      onProgress: ({ bytesWritten }) => onProgress((base + bytesWritten) / LOCAL_MODEL_BYTES),
    });
    try {
      await active.downloadAsync();
    } catch {
      if (cancelled) throw new Error('Download cancelled.');
      throw new Error('Download failed — check your connection and try again.');
    } finally {
      active?.release();
      active = null;
    }
    if (!isComplete(f)) {
      if (file.exists) file.delete();
      throw new Error('The downloaded file looks incomplete. Please try again.');
    }
    doneBytes += f.bytes;
    onProgress(doneBytes / LOCAL_MODEL_BYTES);
  }
}

export function cancelDownload() {
  cancelled = true;
  active?.cancel();
}

export function deleteModel() {
  for (const f of FILES) {
    const file = fileFor(f);
    if (file.exists) file.delete();
  }
}
