const crypto = require("crypto");

const TTL_MS = 60_000;
const store = new Map();

function get(key) {
  const entry = store.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    store.delete(key);
    return null;
  }
  return entry;
}

function set(key, body) {
  const json = JSON.stringify(body);
  const etag = '"' + crypto.createHash("sha1").update(json).digest("hex") + '"';
  const entry = { body, json, etag, expiresAt: Date.now() + TTL_MS };
  store.set(key, entry);
  return entry;
}

function del(key) {
  store.delete(key);
}

function bust() {
  store.clear();
}

module.exports = { get, set, del, bust, TTL_MS };
