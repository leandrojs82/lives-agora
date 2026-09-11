import { describe, it, expect } from 'vitest';

describe('ambiente de teste', () => {
  it('tem localStorage (jsdom)', () => {
    localStorage.setItem('a', '1');
    expect(localStorage.getItem('a')).toBe('1');
  });
});
