async function retry(fn, { maxAttempts = 3, initialDelayMs = 1000, backoffFactor = 2 } = {}) {
  let attempt = 1;
  let delay = initialDelayMs;
  
  while (attempt <= maxAttempts) {
    try {
      return await fn();
    } catch (err) {
      if (attempt === maxAttempts) throw err;
      await new Promise(resolve => setTimeout(resolve, delay));
      delay *= backoffFactor;
      attempt++;
    }
  }
}

module.exports = retry;