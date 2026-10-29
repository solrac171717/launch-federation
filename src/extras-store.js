// Documents (files) and reminders attached to assets. Same idea as asset-store.js: one async interface,
// two backends: the user's Supabase account (private Storage bucket + tables) or this device (IndexedDB + localStorage).
import { newId } from './asset-store.js';
import { nextDue } from './reminders.js';

export const DOC_KINDS = { deed: 'Deed or title', insurance: 'Insurance', registration: 'Registration', invoice: 'Invoice or receipt', photo: 'Photo', other: 'Other' };
export const MAX_DOC_BYTES = 10 * 1024 * 1024;
const ALLOWED = /\.(pdf|png|jpe?g|webp|heic|gif|docx?|xlsx?|csv|txt)$/i;

export const safeName = n => String(n || 'file').normalize('NFKD').replace(/[^\w.\- ]+/g, '').trim().replace(/\s+/g, '-').replace(/^\.+/, '').slice(-90) || 'file';
export function validateFile(file) {
  if (!file) return 'Choose a file.';
  if (!file.size) return 'That file is empty.';
  if (file.size > MAX_DOC_BYTES) return 'Files can be up to 10 MB.';
  if (!ALLOWED.test(file.name || '')) return 'Use a PDF, image, Word, Excel, CSV or text file.';
  return null;
}
export const sizeText = n => (n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`);

const docFromDb = r => ({ id: r.id, assetId: r.asset_id, name: r.name, kind: r.kind, path: r.path, size: Number(r.size), mime: r.mime, createdAt: r.created_at });
const remFromDb = r => ({ id: r.id, assetId: r.asset_id, title: r.title, kind: r.kind, dueOn: r.due_on, repeat: r.repeat, notifyDays: r.notify_days, done: !!r.done, lastNotifiedOn: r.last_notified_on, createdAt: r.created_at });
const remToDb = v => ({ title: v.title, kind: v.kind, due_on: v.dueOn, repeat: v.repeat, notify_days: v.notifyDays });

/* ------------------------------------------------------------------ this device */
function openDb(idb) {
  return new Promise((res, rej) => {
    const q = idb.open('atlas-files', 1);
    q.onupgradeneeded = () => q.result.createObjectStore('blobs');
    q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error);
  });
}
const idbDo = (db, mode, fn) => new Promise((res, rej) => { const t = db.transaction('blobs', mode); const r = fn(t.objectStore('blobs')); t.oncomplete = () => res(r && r.result); t.onerror = () => rej(t.error); t.onabort = () => rej(t.error); });

export function createLocalExtras({ storage = globalThis.localStorage, idb = globalThis.indexedDB } = {}) {
  const read = k => { try { const v = JSON.parse(storage.getItem(k) || '[]'); return Array.isArray(v) ? v : []; } catch { return []; } };
  const write = (k, v) => { try { storage.setItem(k, JSON.stringify(v)); } catch { throw new Error('This browser cannot save data (storage is full or blocked).'); } };
  const DOCS = 'atlas.docs.v1', REMS = 'atlas.reminders.v1';
  const urls = new Map();
  return {
    kind: 'device',
    canEmail: false,
    async listDocs() { return read(DOCS); },
    async addDoc(assetId, file, kind = 'other') {
      if (!idb) throw new Error('This browser cannot store files.');
      const id = newId(), db = await openDb(idb);
      try { await idbDo(db, 'readwrite', s => s.put(file, id)); } catch { throw new Error('Could not save the file (browser storage is full or blocked).'); }
      const doc = { id, assetId, name: file.name, kind, path: id, size: file.size, mime: file.type || null, createdAt: new Date().toISOString() };
      write(DOCS, [...read(DOCS), doc]); return doc;
    },
    async removeDoc(doc) {
      write(DOCS, read(DOCS).filter(d => d.id !== doc.id));
      if (idb) { const db = await openDb(idb); await idbDo(db, 'readwrite', s => s.delete(doc.id)); }
      if (urls.has(doc.id)) { URL.revokeObjectURL(urls.get(doc.id)); urls.delete(doc.id); }
    },
    async docUrl(doc) {
      if (urls.has(doc.id)) return urls.get(doc.id);
      const db = await openDb(idb), blob = await idbDo(db, 'readonly', s => s.get(doc.id));
      if (!blob) throw new Error('That file is no longer on this device.');
      const u = URL.createObjectURL(blob); urls.set(doc.id, u); return u;
    },
    async removeForAsset(assetId) { for (const d of read(DOCS).filter(x => x.assetId === assetId)) await this.removeDoc(d); write(REMS, read(REMS).filter(r => r.assetId !== assetId)); },
    async listReminders() { return read(REMS); },
    async addReminder(assetId, v) { const r = { id: newId(), assetId, ...v, done: false, lastNotifiedOn: null, createdAt: new Date().toISOString() }; write(REMS, [...read(REMS), r]); return r; },
    async updateReminder(id, v) { const l = read(REMS), i = l.findIndex(r => r.id === id); if (i < 0) throw new Error('That reminder no longer exists.'); l[i] = { ...l[i], ...v }; write(REMS, l); return l[i]; },
    async removeReminder(id) { write(REMS, read(REMS).filter(r => r.id !== id)); },
  };
}

/* ------------------------------------------------------------------ Supabase */
/** `owner`: the account the files and reminders belong to (your own id, or the one of an account shared with you). */
export function createCloudExtras(cloud, bucket = 'asset-docs', owner = null) {
  const only = owner ? `user_id=eq.${encodeURIComponent(owner)}&` : '', mine = owner ? { user_id: owner } : {};
  return {
    kind: 'cloud',
    canEmail: true,
    async listDocs() { return (await cloud.rest('GET', `/asset_documents?${only}select=*&order=created_at.desc`)).map(docFromDb); },
    async addDoc(assetId, file, kind = 'other') {
      const uid = owner || cloud.user()?.id; if (!uid) throw new Error('Please sign in again.');
      const path = `${uid}/${assetId}/${newId()}-${safeName(file.name)}`;
      await cloud.upload(bucket, path, file, file.type);
      try {
        const [r] = await cloud.rest('POST', '/asset_documents', { ...mine, asset_id: assetId, name: file.name.slice(0, 200), kind, path, size: file.size, mime: file.type || null }, { prefer: 'return=representation' });
        return docFromDb(r);
      } catch (e) { try { await cloud.removeObject(bucket, path); } catch { /* the orphan is harmless: nobody else can read it */ } throw e; }
    },
    async removeDoc(doc) { await cloud.rest('DELETE', `/asset_documents?id=eq.${encodeURIComponent(doc.id)}`); try { await cloud.removeObject(bucket, doc.path); } catch { /* row is gone, file removal is best effort */ } },
    docUrl: doc => cloud.signedUrl(bucket, doc.path, 600),
    async removeForAsset(assetId) {
      const docs = await cloud.rest('GET', `/asset_documents?asset_id=eq.${encodeURIComponent(assetId)}&select=path`);
      for (const d of docs) { try { await cloud.removeObject(bucket, d.path); } catch { /* best effort: the rows are removed with the asset */ } }
    },
    async listReminders() { return (await cloud.rest('GET', `/asset_reminders?${only}select=*&order=due_on.asc`)).map(remFromDb); },
    async addReminder(assetId, v) { const [r] = await cloud.rest('POST', '/asset_reminders', { ...mine, asset_id: assetId, ...remToDb(v) }, { prefer: 'return=representation' }); return remFromDb(r); },
    async updateReminder(id, v) {
      const body = {}; if ('title' in v) Object.assign(body, remToDb(v)); if ('done' in v) body.done = v.done; if ('dueOn' in v && !('title' in v)) body.due_on = v.dueOn;
      if ('lastNotifiedOn' in v) body.last_notified_on = v.lastNotifiedOn;
      const [r] = await cloud.rest('PATCH', `/asset_reminders?id=eq.${encodeURIComponent(id)}`, body, { prefer: 'return=representation' });
      if (!r) throw new Error('That reminder no longer exists.'); return remFromDb(r);
    },
    async removeReminder(id) { await cloud.rest('DELETE', `/asset_reminders?id=eq.${encodeURIComponent(id)}`); },
  };
}

/** Marking a repeating reminder done moves it to its next date (and re-arms the email); one-off reminders stay done. */
export const completionPatch = r => (r.repeat && r.repeat !== 'none' ? { dueOn: nextDue(r.dueOn, r.repeat), done: false, lastNotifiedOn: null } : { done: true });
