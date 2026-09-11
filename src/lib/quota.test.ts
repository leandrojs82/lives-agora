import { describe, it, expect } from 'vitest';
import { pacificDateKey, addQuota, getQuotaUsed } from './quota';

describe('quota', () => {
  it('pacificDateKey usa o fuso America/Los_Angeles', () => {
    // 2026-09-11T05:00Z = 2026-09-10 22:00 PDT
    expect(pacificDateKey(new Date('2026-09-11T05:00:00Z'))).toBe('2026-09-10');
    // 2026-09-11T08:00Z = 2026-09-11 01:00 PDT
    expect(pacificDateKey(new Date('2026-09-11T08:00:00Z'))).toBe('2026-09-11');
  });

  it('começa em zero', () => {
    expect(getQuotaUsed(new Date('2026-09-11T12:00:00Z'))).toBe(0);
  });

  it('soma unidades do mesmo dia', () => {
    const d = new Date('2026-09-11T12:00:00Z');
    expect(addQuota(100, d)).toBe(100);
    expect(addQuota(1, d)).toBe(101);
    expect(getQuotaUsed(d)).toBe(101);
  });

  it('separa por dia de cota', () => {
    addQuota(500, new Date('2026-09-11T05:00:00Z')); // dia 10 PDT
    addQuota(7, new Date('2026-09-11T08:00:00Z')); // dia 11 PDT
    expect(getQuotaUsed(new Date('2026-09-11T05:00:00Z'))).toBe(500);
    expect(getQuotaUsed(new Date('2026-09-11T08:00:00Z'))).toBe(7);
  });

  it('trata valor corrompido como zero', () => {
    localStorage.setItem('quota:2026-09-11', 'abc');
    expect(getQuotaUsed(new Date('2026-09-11T12:00:00Z'))).toBe(0);
  });
});
