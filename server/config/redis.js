const store = new Map();

module.exports = {
  async set(key, value, mode, ttlSeconds) {
    // support signature: set(key, value, 'EX', ttl)
    store.set(key, value);
    if (mode === 'EX' && typeof ttlSeconds === 'number') {
      setTimeout(() => store.delete(key), ttlSeconds * 1000);
    }
    return 'OK';
  },
  async get(key) {
    return store.get(key) || null;
  },
  async del(key) {
    return store.delete(key);
  },
};
