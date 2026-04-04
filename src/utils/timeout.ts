/**
 * 统一超时控制工具
 *
 * 消除各模块中重复的 withTimeout 实现（pipeline、patch-generator 等）
 */

/**
 * 为任意 Promise 添加超时保护。
 *
 * 超时后抛出 Error，上层调用方可统一捕获。
 *
 * @param promise  要执行的 Promise
 * @param timeoutMs  超时毫秒数
 * @param label   超时日志标签，方便排查
 */
export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  label = 'operation'
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | null = null;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error(`${label} timed out after ${timeoutMs}ms`));
    }, timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timer !== null) clearTimeout(timer);
  }
}

/**
 * 为同步函数添加超时保护（内部转为 Promise 执行）。
 */
export async function withTimeoutSync<T>(
  fn: () => T,
  timeoutMs: number,
  label = 'operation'
): Promise<T> {
  return withTimeout(
    new Promise<T>((resolve, reject) => {
      try {
        resolve(fn());
      } catch (err) {
        reject(err instanceof Error ? err : new Error(String(err)));
      }
    }),
    timeoutMs,
    label
  );
}
