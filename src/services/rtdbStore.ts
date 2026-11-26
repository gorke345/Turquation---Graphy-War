/**
 * Unified Realtime Database Store Adapter.
 *
 * - Production / Configured `.env`: 100% Firebase Realtime Database (`onValue`,
 *   `runTransaction`, `onDisconnect`, `set`, `update`, `remove`, `get`).
 * - Unconfigured Preview Fallback (when `VITE_FIREBASE_DATABASE_URL` is empty):
 *   Strictly ephemeral in-memory + `BroadcastChannel` multi-tab store implementing
 *   the exact same RTDB tree & `onDisconnect` contract across browser tabs (zero
 *   WebSocket server, zero Express, zero bots).
 */

import {
  get as fbGet,
  onDisconnect as fbOnDisconnect,
  onValue as fbOnValue,
  ref as fbRef,
  remove as fbRemove,
  runTransaction as fbRunTransaction,
  set as fbSet,
  update as fbUpdate,
} from 'firebase/database';
import { rtdb } from '../firebase';
import { sanitizeForRtdb } from '../engine/rtdbSanitizer';

export { sanitizeForRtdb };

export interface RtdbStore {
  readonly isLiveFirebase: boolean;
  get<T = unknown>(path: string): Promise<T | null>;
  set(path: string, value: unknown): Promise<void>;
  update(path: string, patch: Record<string, unknown>): Promise<void>;
  remove(path: string): Promise<void>;
  onValue<T = unknown>(path: string, cb: (val: T | null) => void): () => void;
  runTransaction<T = unknown>(
    path: string,
    updater: (current: T | null) => T | undefined
  ): Promise<{ committed: boolean; value: T | null }>;
  onDisconnectRemove(path: string): Promise<() => Promise<void>>;
  onDisconnectSet(path: string, value: unknown): Promise<() => Promise<void>>;
}

function createFirebaseRtdbStore(): RtdbStore {
  const db = rtdb!;
  return {
    isLiveFirebase: true,
    async get<T = unknown>(path: string): Promise<T | null> {
      const snap = await fbGet(fbRef(db, path));
      return snap.exists() ? (snap.val() as T) : null;
    },
    async set(path: string, value: unknown): Promise<void> {
      await fbSet(fbRef(db, path), sanitizeForRtdb(value));
    },
    async update(path: string, patch: Record<string, unknown>): Promise<void> {
      const cleaned: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(patch)) {
        cleaned[k] = v === undefined ? null : sanitizeForRtdb(v);
      }
      await fbUpdate(fbRef(db, path), cleaned);
    },
    async remove(path: string): Promise<void> {
      await fbRemove(fbRef(db, path));
    },
    onValue<T = unknown>(path: string, cb: (val: T | null) => void): () => void {
      return fbOnValue(fbRef(db, path), (snap) => {
        cb(snap.exists() ? (snap.val() as T) : null);
      });
    },
    async runTransaction<T = unknown>(
      path: string,
      updater: (current: T | null) => T | undefined
    ): Promise<{ committed: boolean; value: T | null }> {
      const res = await fbRunTransaction(fbRef(db, path), (cur) => {
        const next = updater(cur as T | null);
        // Returning undefined aborts the Firebase transaction cleanly
        if (next === undefined) return undefined;
        return sanitizeForRtdb(next);
      });
      return {
        committed: res.committed,
        value: res.snapshot.exists() ? (res.snapshot.val() as T) : null,
      };
    },
    async onDisconnectRemove(path: string): Promise<() => Promise<void>> {
      const handle = fbOnDisconnect(fbRef(db, path));
      await handle.remove();
      return async () => {
        await handle.cancel().catch(() => {});
      };
    },
    async onDisconnectSet(path: string, value: unknown): Promise<() => Promise<void>> {
      const handle = fbOnDisconnect(fbRef(db, path));
      await handle.set(sanitizeForRtdb(value));
      return async () => {
        await handle.cancel().catch(() => {});
      };
    },
  };
}

// ---------------------------------------------------------------------------
// Strictly Ephemeral Multi-Tab Preview Fallback (used ONLY when .env is empty)
// ---------------------------------------------------------------------------

function clone<T>(v: T): T {
  if (v === undefined || v === null) return null as unknown as T;
  return JSON.parse(JSON.stringify(v));
}

function cleanNulls(obj: unknown): unknown {
  if (obj === null || obj === undefined) return null;
  if (typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(cleanNulls);
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    if (v === null || v === undefined) continue;
    const cleaned = cleanNulls(v);
    if (cleaned !== null) out[k] = cleaned;
  }
  return Object.keys(out).length === 0 ? null : out;
}

class EphemeralBroadcastRtdbStore implements RtdbStore {
  public readonly isLiveFirebase = false;
  private root: Record<string, unknown> = {};
  private listeners = new Map<string, Set<(val: unknown) => void>>();
  private disconnectActions = new Map<string, { type: 'remove' | 'set'; value?: unknown }>();
  private channel: BroadcastChannel | null = null;
  private tabId = `tab_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

  constructor() {
    if (typeof window !== 'undefined' && typeof BroadcastChannel !== 'undefined') {
      try {
        this.channel = new BroadcastChannel('turquation_ephemeral_rtdb_v1');
        this.channel.onmessage = (ev) => {
          const msg = ev.data as {
            sender: string;
            type: 'write' | 'sync_req' | 'sync_res';
            path?: string;
            value?: unknown;
            root?: Record<string, unknown>;
          };
          if (!msg || msg.sender === this.tabId) return;
          if (msg.type === 'write' && msg.path !== undefined) {
            this.setLocalPath(msg.path, msg.value, false);
          } else if (msg.type === 'sync_req') {
            try {
              this.channel?.postMessage({
                sender: this.tabId,
                type: 'sync_res',
                root: clone(this.root),
              });
            } catch {
              // Ignore cross-tab postMessage errors in restricted iframes
            }
          } else if (msg.type === 'sync_res' && msg.root) {
            this.mergeRoot(msg.root);
          }
        };
        // Request initial live state from any already-open tab
        this.channel.postMessage({ sender: this.tabId, type: 'sync_req' });
      } catch {
        this.channel = null;
      }

      window.addEventListener('beforeunload', () => {
        for (const [path, action] of this.disconnectActions.entries()) {
          if (action.type === 'remove') {
            this.setLocalPath(path, null, true);
          } else {
            this.setLocalPath(path, action.value ?? null, true);
          }
        }
      });
    }
  }

  private mergeRoot(incoming: Record<string, unknown>) {
    const mergeObj = (target: Record<string, unknown>, src: Record<string, unknown>) => {
      for (const [k, v] of Object.entries(src)) {
        if (v && typeof v === 'object' && !Array.isArray(v)) {
          if (!target[k] || typeof target[k] !== 'object' || Array.isArray(target[k])) {
            target[k] = {};
          }
          mergeObj(target[k] as Record<string, unknown>, v as Record<string, unknown>);
        } else {
          target[k] = clone(v);
        }
      }
    };
    mergeObj(this.root, incoming);
    this.notifyAll();
  }

  private parts(path: string): string[] {
    return path.split('/').filter(Boolean);
  }

  private getAt(path: string): unknown {
    const segs = this.parts(path);
    let cur: unknown = this.root;
    for (const s of segs) {
      if (!cur || typeof cur !== 'object') return null;
      cur = (cur as Record<string, unknown>)[s];
    }
    return cur === undefined ? null : clone(cur);
  }

  private setLocalPath(path: string, value: unknown, broadcast: boolean) {
    const segs = this.parts(path);
    if (segs.length === 0) return;

    const cleaned = cleanNulls(clone(value));
    if (cleaned === null) {
      let cur: unknown = this.root;
      for (let i = 0; i < segs.length - 1; i++) {
        if (!cur || typeof cur !== 'object') return;
        cur = (cur as Record<string, unknown>)[segs[i]];
      }
      if (cur && typeof cur === 'object') {
        delete (cur as Record<string, unknown>)[segs[segs.length - 1]];
      }
    } else {
      let cur: Record<string, unknown> = this.root;
      for (let i = 0; i < segs.length - 1; i++) {
        const key = segs[i];
        if (!cur[key] || typeof cur[key] !== 'object' || Array.isArray(cur[key])) {
          cur[key] = {};
        }
        cur = cur[key] as Record<string, unknown>;
      }
      cur[segs[segs.length - 1]] = cleaned;
    }

    if (broadcast) {
      this.channel?.postMessage({
        sender: this.tabId,
        type: 'write',
        path,
        value: cleaned,
      });
    }
    this.notifyAffected(path);
  }

  private notifyAffected(changedPath: string) {
    const normChanged = this.parts(changedPath).join('/');
    for (const [listenPath, cbs] of this.listeners.entries()) {
      const normListen = this.parts(listenPath).join('/');
      if (
        normChanged === normListen ||
        normChanged.startsWith(`${normListen}/`) ||
        normListen.startsWith(`${normChanged}/`)
      ) {
        const val = this.getAt(listenPath);
        for (const cb of cbs) cb(val);
      }
    }
  }

  private notifyAll() {
    for (const [listenPath, cbs] of this.listeners.entries()) {
      const val = this.getAt(listenPath);
      for (const cb of cbs) cb(val);
    }
  }

  async get<T = unknown>(path: string): Promise<T | null> {
    return this.getAt(path) as T | null;
  }

  async set(path: string, value: unknown): Promise<void> {
    this.setLocalPath(path, value, true);
  }

  async update(path: string, patch: Record<string, unknown>): Promise<void> {
    for (const [k, v] of Object.entries(patch)) {
      const subPath = path ? `${path}/${k}` : k;
      this.setLocalPath(subPath, v, true);
    }
  }

  async remove(path: string): Promise<void> {
    this.setLocalPath(path, null, true);
  }

  onValue<T = unknown>(path: string, cb: (val: T | null) => void): () => void {
    let set = this.listeners.get(path);
    if (!set) {
      set = new Set();
      this.listeners.set(path, set);
    }
    const wrapped = cb as (val: unknown) => void;
    set.add(wrapped);
    // Deliver initial value asynchronously like Firebase RTDB onValue
    const initial = this.getAt(path) as T | null;
    queueMicrotask(() => {
      if (set?.has(wrapped)) cb(initial);
    });
    return () => {
      set?.delete(wrapped);
      if (set && set.size === 0) this.listeners.delete(path);
    };
  }

  async runTransaction<T = unknown>(
    path: string,
    updater: (current: T | null) => T | undefined
  ): Promise<{ committed: boolean; value: T | null }> {
    const current = this.getAt(path) as T | null;
    const next = updater(current);
    if (next === undefined) {
      return { committed: false, value: current };
    }
    this.setLocalPath(path, next, true);
    return { committed: true, value: this.getAt(path) as T | null };
  }

  async onDisconnectRemove(path: string): Promise<() => Promise<void>> {
    this.disconnectActions.set(path, { type: 'remove' });
    return async () => {
      this.disconnectActions.delete(path);
    };
  }

  async onDisconnectSet(path: string, value: unknown): Promise<() => Promise<void>> {
    this.disconnectActions.set(path, { type: 'set', value });
    return async () => {
      this.disconnectActions.delete(path);
    };
  }
}

export const rtdbStore: RtdbStore = rtdb
  ? createFirebaseRtdbStore()
  : new EphemeralBroadcastRtdbStore();
