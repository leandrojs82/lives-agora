import { QuotaExceededError, AuthError } from '../api/youtubeClient';

export function errorToBanner(e: unknown): { kind: 'error' | 'warning'; text: string } {
  if (e instanceof QuotaExceededError) {
    return {
      kind: 'warning',
      text: 'Cota diária da YouTube API esgotada. Ela volta à meia-noite (horário do Pacífico). Mostrando o último resultado salvo.',
    };
  }
  if (e instanceof AuthError) {
    return { kind: 'error', text: e.message };
  }
  const msg = e instanceof Error ? e.message : 'Erro desconhecido';
  return { kind: 'error', text: `Falha ao consultar o YouTube: ${msg}. Tente atualizar novamente.` };
}
