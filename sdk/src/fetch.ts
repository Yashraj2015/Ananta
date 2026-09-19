export async function anantaFetch(url: string, options?: RequestInit) {
  // - Error response parsing
  // - Retry on 503
  // - Request ID header for tracing
  let retries = 3;
  while (retries > 0) {
      try {
          const response = await fetch(url, options);
          if (response.status === 503) {
              retries--;
              await new Promise(resolve => setTimeout(resolve, 1000));
              continue;
          }
          return response;
      } catch (err) {
          throw err;
      }
  }
  throw new Error('Service Unavailable');
}
