const WINDOW_MS = 60 * 1000;
const MAX_REQUESTS = 30;

const store = new Map();

function checkRate(key) {
  const now = Date.now();
  let record = store.get(key);

  if (!record || now - record.windowStart > WINDOW_MS) {
    record = { windowStart: now, count: 0, locked: false };
  }

  record.count++;
  store.set(key, record);

  if (record.locked) {
    return { allowed: false, reason: "locked", remaining: 0 };
  }

  if (record.count > MAX_REQUESTS) {
    record.locked = true;
    store.set(key, record);
    return { allowed: false, reason: "rate_limit", remaining: 0 };
  }

  return {
    allowed: true,
    remaining: MAX_REQUESTS - record.count,
  };
}

function unlock(key) {
  const record = store.get(key);
  if (record) {
    record.locked = false;
    record.count = 0;
    record.windowStart = Date.now();
    store.set(key, record);
  }
}

setInterval(() => {
  const now = Date.now();
  for (const [key, record] of store) {
    if (!record.locked && now - record.windowStart > WINDOW_MS * 2) {
      store.delete(key);
    }
  }
}, WINDOW_MS * 5);

module.exports = { checkRate, unlock };
