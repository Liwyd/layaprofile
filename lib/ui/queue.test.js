import { describe, expect, it } from 'vitest';
import { runWithConcurrency } from './queue';

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

describe('runWithConcurrency', () => {
  it('never runs more than the limit at once', async () => {
    let running = 0;
    let peak = 0;
    const outcomes = await runWithConcurrency([1, 2, 3, 4, 5, 6], 2, async item => {
      running += 1;
      peak = Math.max(peak, running);
      await sleep(5);
      running -= 1;
      return item * 2;
    });
    expect(peak).toBe(2);
    expect(outcomes.map(outcome => outcome.value)).toEqual([2, 4, 6, 8, 10, 12]);
  });

  it('keeps outcomes in input order even when tasks finish out of order', async () => {
    const outcomes = await runWithConcurrency([30, 1, 10], 3, async ms => {
      await sleep(ms);
      return ms;
    });
    expect(outcomes.map(outcome => outcome.value)).toEqual([30, 1, 10]);
  });

  it('isolates failures: one rejection does not stop the others', async () => {
    const outcomes = await runWithConcurrency(['a', 'bad', 'c', 'd'], 2, async item => {
      if (item === 'bad') throw new Error('boom');
      return item;
    });
    expect(outcomes.map(outcome => outcome.status)).toEqual([
      'fulfilled',
      'rejected',
      'fulfilled',
      'fulfilled',
    ]);
    expect(outcomes[1].reason.message).toBe('boom');
  });

  it('handles synchronous throws and an empty list', async () => {
    const outcomes = await runWithConcurrency([1], 2, () => {
      throw new Error('sync');
    });
    expect(outcomes[0].status).toBe('rejected');
    expect(await runWithConcurrency([], 2, async () => 1)).toEqual([]);
  });

  it('treats an invalid limit as one lane', async () => {
    let running = 0;
    let peak = 0;
    const worker = async () => {
      running += 1;
      peak = Math.max(peak, running);
      await sleep(2);
      running -= 1;
    };
    await runWithConcurrency([1, 2, 3], 0, worker);
    expect(peak).toBe(1);
    peak = 0;
    await runWithConcurrency([1, 2, 3], Number.NaN, worker);
    expect(peak).toBe(1);
  });

  it('stops starting new items once aborted and marks them skipped', async () => {
    const controller = new AbortController();
    const started = [];
    const outcomes = await runWithConcurrency(
      [1, 2, 3, 4],
      1,
      async item => {
        started.push(item);
        if (item === 2) controller.abort();
        return item;
      },
      { signal: controller.signal },
    );
    expect(started).toEqual([1, 2]);
    expect(outcomes.map(outcome => outcome.status)).toEqual([
      'fulfilled',
      'fulfilled',
      'skipped',
      'skipped',
    ]);
  });
});
