export type RetryableFetchOptions = {
  timeoutMs?: number;
  maxAttempts?: number;
  baseDelayMs?: number;
};

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function shouldRetry(status: number): boolean {
  return status === 408 || status === 429 || status >= 500;
}

export async function postJsonWithRetry(
  url: string,
  body: string,
  headers: Record<string, string>,
  opts?: RetryableFetchOptions
): Promise<Response> {
  const timeoutMs = Math.max(1000, opts?.timeoutMs ?? 10_000);
  const maxAttempts = Math.max(1, opts?.maxAttempts ?? 3);
  const baseDelayMs = Math.max(100, opts?.baseDelayMs ?? 500);

  let lastError: Error | null = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const started = Date.now();
    try {
      const response = await fetch(url, {
        method: "POST",
        headers,
        body,
        signal: controller.signal,
      });
      const elapsedMs = Date.now() - started;
      if (response.ok) {
        return response;
      }
      if (attempt < maxAttempts && shouldRetry(response.status)) {
        console.warn(
          `[OutboundHTTP] retrying ${url} attempt=${attempt + 1}/${maxAttempts} status=${response.status} elapsedMs=${elapsedMs}`
        );
        await delay(baseDelayMs * Math.pow(2, attempt - 1));
        continue;
      }
      return response;
    } catch (err) {
      const elapsedMs = Date.now() - started;
      lastError = err as Error;
      if (attempt < maxAttempts) {
        console.warn(
          `[OutboundHTTP] retrying ${url} attempt=${attempt + 1}/${maxAttempts} error=${lastError.message} elapsedMs=${elapsedMs}`
        );
        await delay(baseDelayMs * Math.pow(2, attempt - 1));
        continue;
      }
      throw lastError;
    } finally {
      clearTimeout(timer);
    }
  }

  throw lastError ?? new Error("postJsonWithRetry failed");
}
