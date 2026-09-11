import { describe, it, expect } from 'vitest';
import { formatViewers, formatElapsed, formatAgo } from './format';

describe('formatViewers', () => {
  it('formata compactado em pt-BR', () => {
    expect(formatViewers(undefined)).toBe('');
    expect(formatViewers(0)).toBe('0');
    expect(formatViewers(999)).toBe('999');
    expect(formatViewers(12345).replace(/\u00a0/g, ' ')).toBe('12,3 mil');
    expect(formatViewers(1_200_000).replace(/\u00a0/g, ' ')).toBe('1,2 mi');
  });
});

describe('formatElapsed', () => {
  const now = Date.parse('2026-09-11T12:00:00Z');
  it('minutos', () => {
    expect(formatElapsed('2026-09-11T11:15:00Z', now)).toBe('45min');
  });
  it('horas e minutos', () => {
    expect(formatElapsed('2026-09-11T10:37:00Z', now)).toBe('1h 23min');
  });
  it('dias e horas', () => {
    expect(formatElapsed('2026-09-09T09:00:00Z', now)).toBe('2d 3h');
  });
  it('início no futuro ou inválido vira 0min', () => {
    expect(formatElapsed('2026-09-11T13:00:00Z', now)).toBe('0min');
    expect(formatElapsed('lixo', now)).toBe('0min');
  });
});

describe('formatAgo', () => {
  const now = Date.parse('2026-09-11T12:00:00Z');
  it('casos', () => {
    expect(formatAgo(now - 20_000, now)).toBe('agora');
    expect(formatAgo(now - 5 * 60_000, now)).toBe('há 5 min');
    expect(formatAgo(now - 2 * 3_600_000, now)).toBe('há 2 h');
    expect(formatAgo(now - 3 * 86_400_000, now)).toBe('há 3 d');
  });
});
