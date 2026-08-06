// Local development store.
//
// A JSON file under .devdata/, written after every mutation. Not a database and not
// trying to be one: it exists so a write made in the operations app is still there after
// a restart, and so a submission made in the public portal shows up in the registry.
//
// Single-process only. Writes are serialised through one in-flight promise rather than
// locked, which is correct for one dev server and would not be for anything else.

import fs from 'node:fs';
import path from 'node:path';
import { freshStore } from './seed.mjs';

export function createStore({ file }) {
  let data = load();
  let writing = Promise.resolve();

  function load() {
    try {
      const raw = fs.readFileSync(file, 'utf8');
      const parsed = JSON.parse(raw);
      // Any collection the seed grew since this file was written comes in empty rather
      // than undefined, so callers never have to guard for a missing key.
      return { ...freshStore(), ...parsed };
    } catch {
      return freshStore();
    }
  }

  function persist() {
    writing = writing.then(() => fs.promises
      .mkdir(path.dirname(file), { recursive: true })
      .then(() => fs.promises.writeFile(file, JSON.stringify(data, null, 2)))
      .catch(e => console.error('[dev-store] write failed:', e.message)));
    return writing;
  }

  return {
    get: () => data,
    /** Mutate in place, then persist. The return value of `fn` is passed back to caller. */
    mutate(fn) {
      const result = fn(data);
      persist();
      return result;
    },
    /** Reset to the seeded dataset — the "start over" button. */
    reset() {
      data = freshStore();
      persist();
      return data;
    },
    /** Next registry reference, and advance the sequence. */
    mintReference(prefix = 'NITDA/REG') {
      const year = new Date().getFullYear();
      const n = data.nextReference++;
      persist();
      return `${prefix}/${year}/${String(n).padStart(4, '0')}`;
    },
    audit(event) {
      data.auditLog.unshift({ at: new Date().toISOString(), ...event });
      data.auditLog = data.auditLog.slice(0, 2000);
      persist();
    },
    flush: () => writing,
    file,
  };
}
