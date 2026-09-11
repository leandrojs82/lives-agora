import { describe, it, expect } from 'vitest';
import { mapWithConcurrency } from './concurrency';

describe('mapWithConcurrency', () => {
  it('preserva ordem e limita paralelismo', async () => {
    let running = 0;
    let peak = 0;
    const items = [1, 2, 3, 4, 5, 6, 7];
    const out = await mapWithConcurrency(items, 3, async (n) => {
      running++;
      peak = Math.max(peak, running);
      await new Promise((r) => setTimeout(r, 5));
      running--;
      return n * 2;
    });
    expect(out).toEqual([2, 4, 6, 8, 10, 12, 14]);
    expect(peak).toBe(3);
  });

  it('lista vazia', async () => {
    expect(await mapWithConcurrency([], 4, async (x) => x)).toEqual([]);
  });

  it('propaga erro', async () => {
    await expect(
      mapWithConcurrency([1, 2], 2, async (n) => {
        if (n === 2) throw new Error('boom');
        return n;
      }),
    ).rejects.toThrow('boom');
  });

  it('para de processar itens restantes após a primeira falha', async () => {
    const calls: number[] = [];
    await expect(
      mapWithConcurrency([1, 2, 3], 1, async (n) => {
        calls.push(n);
        if (n === 1) throw new Error('boom');
        return n;
      }),
    ).rejects.toThrow('boom');
    expect(calls).toEqual([1]);
  });
});
