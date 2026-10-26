// Daily copy of all data in the phone's public Documents/DailyHub folder. Unlike the app's
// own storage, files there are not deleted when the app is uninstalled, so after a reinstall
// the latest one can be picked from the first screen to bring everything back.
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { isNative } from './platform.js';
import { makeBackup } from './backup.js';
import { dateKey } from './dates.js';

export const AUTO_DIR = 'DailyHub';
const KEEP = 7;
const NAME = /^DailyHub_auto_\d{8}\.json$/;

export const autoFileName = (key) => `DailyHub_auto_${key.replace(/-/g, '')}.json`;

// Newest first; files beyond `keep` are the ones to delete
export function filesToPrune(names, keep = KEEP) {
  return names.filter((n) => NAME.test(n)).sort().reverse().slice(keep);
}

// Writes at most one file a day. Returns the day saved, or null when nothing was written.
export async function runAutoBackup(state) {
  if (!isNative() || !state.settings.autoBackup) return null;
  const today = dateKey();
  if (state.settings.lastAutoBackupDay === today) return null;
  try {
    await Filesystem.writeFile({
      path: `${AUTO_DIR}/${autoFileName(today)}`, data: makeBackup(state),
      directory: Directory.Documents, encoding: Encoding.UTF8, recursive: true,
    });
  } catch (err) {
    console.warn('[autobackup] write failed', err);
    return null;
  }
  try {
    const { files } = await Filesystem.readdir({ path: AUTO_DIR, directory: Directory.Documents });
    for (const name of filesToPrune(files.map((f) => f.name))) {
      // files from before a reinstall belong to the old install and may refuse; that is fine
      await Filesystem.deleteFile({ path: `${AUTO_DIR}/${name}`, directory: Directory.Documents }).catch(() => {});
    }
  } catch (err) {
    console.warn('[autobackup] cleanup skipped', err);
  }
  return today;
}
