'use strict';

const fs = require('fs');

const origRename = fs.promises.rename.bind(fs.promises);

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isTransientLock(error) {
  return error != null && ['EPERM', 'EACCES', 'EBUSY'].includes(error.code);
}

function shouldRetryRename(src) {
  return String(src).endsWith('.tmp') || String(src).includes('win-unpacked');
}

fs.promises.rename = async function renameWithRetry(src, dest) {
  if (!shouldRetryRename(src)) {
    return origRename(src, dest);
  }

  let lastError;
  for (let attempt = 0; attempt < 12; attempt++) {
    try {
      if (attempt > 0) {
        await fs.promises.rm(dest, { recursive: true, force: true }).catch(() => {});
      }
      return await origRename(src, dest);
    } catch (error) {
      lastError = error;
      if (!isTransientLock(error)) {
        throw error;
      }
      await sleep(400 * (attempt + 1));
    }
  }

  await fs.promises.cp(src, dest, { recursive: true, force: true });
  await fs.promises.rm(src, { recursive: true, force: true });
  if (lastError) {
    process.stderr.write(
      `[build] rename locked, copied instead: ${src} -> ${dest} (${lastError.code})\n`,
    );
  }
};
