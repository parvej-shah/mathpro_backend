function createTtlCache(ttlMs) {
  let cachedValue = null;
  let cachedAt = 0;

  return {
    clear() {
      cachedValue = null;
      cachedAt = 0;
    },
    async getOrSet(loader) {
      const now = Date.now();
      if (cachedValue !== null && now - cachedAt < ttlMs) {
        return cachedValue;
      }

      const nextValue = await loader();
      if (nextValue && nextValue.success) {
        cachedValue = nextValue;
        cachedAt = now;
      }

      return nextValue;
    },
  };
}

module.exports = { createTtlCache };
