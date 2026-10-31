// In-memory Firestore stand-in for browser tests.
//  window.__SEED  = [[path, data], ...]   initial documents ({__ts: ms} → Timestamp)
//  window.__STALE = { collectionPath: [[id, data], ...] }  what listeners see for a
//                   collection (an out-of-date local cache); transactions still read
//                   the real store, like the server.
//  window.__OFFLINE = true → writes apply locally but never settle; transactions throw.
class Timestamp {
  constructor(ms) { this._ms = ms; this.seconds = Math.floor(ms / 1000); this.nanoseconds = (ms % 1000) * 1e6; }
  toDate() { return new Date(this._ms); }
  toMillis() { return this._ms; }
  toJSON() { return { seconds: this.seconds, nanoseconds: this.nanoseconds }; }
}
const ST = { __serverTimestamp: true };
const store = new Map();
const listeners = new Set();
let autoN = 0;
window.__store = store;
window.__writes = [];
window.__txRuns = 0;

const isPlain = (v) => v && typeof v === "object" && !Array.isArray(v) && !(v instanceof Timestamp);
function norm(v) {
  if (v === ST) return new Timestamp(Date.now());
  if (v instanceof Date) return new Timestamp(v.getTime());
  if (v && typeof v === "object" && typeof v.__ts === "number") return new Timestamp(v.__ts);
  if (Array.isArray(v)) return v.map(norm);
  if (isPlain(v)) { const o = {}; for (const [k, x] of Object.entries(v)) if (x !== undefined) o[k] = norm(x); return o; }
  return v;
}
function copy(v) {
  if (Array.isArray(v)) return v.map(copy);
  if (isPlain(v)) { const o = {}; for (const [k, x] of Object.entries(v)) o[k] = copy(x); return o; }
  return v;
}
function mergeDeep(a, b) {
  const out = { ...a };
  for (const [k, v] of Object.entries(b)) out[k] = isPlain(v) && isPlain(out[k]) ? mergeDeep(out[k], v) : v;
  return out;
}
for (const [path, data] of window.__SEED || []) store.set(path, norm(data));

function mkref(path) {
  const parts = path.split("/").filter(Boolean);
  return { path: parts.join("/"), id: parts[parts.length - 1], kind: parts.length % 2 ? "collection" : "doc" };
}
let scheduled = false;
function notify() {
  if (scheduled) return;
  scheduled = true;
  setTimeout(() => { scheduled = false; for (const l of [...listeners]) l(); }, 0);
}
window.__notify = notify;
const settle = () => (window.__OFFLINE ? new Promise(() => {}) : Promise.resolve());

export function getFirestore() { return { path: "" }; }
export const initializeFirestore = getFirestore;
export function persistentLocalCache() { return {}; }
export function persistentMultipleTabManager() { return {}; }
export function collection(parent, ...segs) { return mkref([parent.path, ...segs].filter(Boolean).join("/")); }
export function doc(parent, ...segs) {
  if (!segs.length) segs = ["auto" + (++autoN).toString(36) + Math.random().toString(36).slice(2, 10)];
  return mkref([parent.path, ...segs].filter(Boolean).join("/"));
}
export function query(col, ...cons) { return { ...col, cons }; }
export function orderBy(field, dir = "asc") { return { field, dir }; }
export function serverTimestamp() { return ST; }

function snapOf(path, data) {
  const r = mkref(path);
  return { id: r.id, ref: r, exists: () => data !== undefined, data: () => (data === undefined ? undefined : copy(data)), metadata: { fromCache: false, hasPendingWrites: false } };
}
function colSnap(q) {
  const stale = window.__STALE && window.__STALE[q.path];
  let rows;
  if (stale) rows = stale.map(([id, d]) => [q.path + "/" + id, norm(d)]);
  else {
    const pre = q.path + "/";
    rows = [...store].filter(([p]) => p.startsWith(pre) && !p.slice(pre.length).includes("/"));
  }
  const ob = (q.cons || []).find((c) => c && c.field);
  if (ob) {
    const key = (d) => (d[ob.field] instanceof Timestamp ? d[ob.field].toMillis() : 0);
    rows.sort((a, b) => (key(a[1]) - key(b[1])) * (ob.dir === "desc" ? -1 : 1));
  }
  const docs = rows.map(([p, d]) => snapOf(p, d));
  return { docs, size: docs.length, empty: !docs.length, forEach: (f) => docs.forEach(f), docChanges: () => [], metadata: { fromCache: false } };
}
export function onSnapshot(target, cb) {
  const fire = () => cb(target.kind === "doc" ? snapOf(target.path, store.get(target.path)) : colSnap(target));
  listeners.add(fire);
  setTimeout(fire, 0);
  return () => listeners.delete(fire);
}
function applySet(path, data, opts) {
  const v = norm(data);
  const cur = store.get(path);
  store.set(path, opts && opts.merge && cur ? mergeDeep(cur, v) : v);
  window.__writes.push(["set", path]);
}
function applyDelete(path) { store.delete(path); window.__writes.push(["delete", path]); }
export function addDoc(col, data) { const r = doc(col); applySet(r.path, data); notify(); return settle().then(() => r); }
export function setDoc(r, data, opts) { applySet(r.path, data, opts); notify(); return settle(); }
export function deleteDoc(r) { applyDelete(r.path); notify(); return settle(); }
export async function getDoc(r) { return snapOf(r.path, store.get(r.path)); }
export async function getDocs(q) { return colSnap(q); }
export function writeBatch() {
  const ops = [];
  const b = {
    set(r, d, o) { ops.push(() => applySet(r.path, d, o)); return b; },
    update(r, d) { ops.push(() => applySet(r.path, d, { merge: true })); return b; },
    delete(r) { ops.push(() => applyDelete(r.path)); return b; },
    commit() { ops.forEach((f) => f()); notify(); return settle(); },
  };
  return b;
}
export async function runTransaction(db, fn) {
  window.__txRuns++;
  if (window.__OFFLINE) throw Object.assign(new Error("Failed to get document because the client is offline."), { code: "unavailable" });
  const ops = [];
  const tr = {
    get: async (r) => snapOf(r.path, store.get(r.path)), // the server's copy, never a stale one
    set(r, d, o) { ops.push(() => applySet(r.path, d, o)); return tr; },
    update(r, d) { ops.push(() => applySet(r.path, d, { merge: true })); return tr; },
    delete(r) { ops.push(() => applyDelete(r.path)); return tr; },
  };
  const result = await fn(tr);
  ops.forEach((f) => f());
  notify();
  return result;
}
