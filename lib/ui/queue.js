/**
 * Runs `worker(item, index)` for every item with at most `limit` running at once and resolves
 * with one outcome per item, in input order. It never rejects: a worker that throws becomes
 * `{ status: 'rejected', reason }` and does not stop the others. When `signal` is aborted no
 * new item is started; items that never ran are `{ status: 'skipped' }`.
 */
export const runWithConcurrency = async (items, limit, worker, { signal } = {}) => {
  const lanes = Math.max(1, Math.floor(limit) || 1);
  const outcomes = new Array(items.length);
  let next = 0;

  const lane = async () => {
    while (next < items.length && !signal?.aborted) {
      const index = next;
      next += 1;
      try {
        outcomes[index] = { status: 'fulfilled', value: await worker(items[index], index) };
      } catch (reason) {
        outcomes[index] = { status: 'rejected', reason };
      }
    }
  };

  await Promise.all(Array.from({ length: Math.min(lanes, items.length) }, lane));
  return Array.from(outcomes, outcome => outcome ?? { status: 'skipped' });
};
