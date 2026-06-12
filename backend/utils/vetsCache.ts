import crypto from 'crypto';

export const TTL_MS = 60_000;

export interface VetsCacheEntry {
  body: unknown;
  json: string;
  etag: string;
  expiresAt: number;
}

const store = new Map<string, VetsCacheEntry>();

export function get(key: string): VetsCacheEntry | null {
  const entry = store.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    store.delete(key);
    return null;
  }
  return entry;
}

export function set(key: string, body: unknown): VetsCacheEntry {
  const json = JSON.stringify(body);
  const etag = '"' + crypto.createHash('sha1').update(json).digest('hex') + '"';
  const entry: VetsCacheEntry = { body, json, etag, expiresAt: Date.now() + TTL_MS };
  store.set(key, entry);
  return entry;
}

export function del(key: string): void {
  store.delete(key);
}

export function bust(): void {
  store.clear();
}
