import { QUOTA_DAILY_LIMIT } from '../config';

export default function QuotaBadge({ used }: { used: number }) {
  const pct = Math.min(100, Math.round((used / QUOTA_DAILY_LIMIT) * 100));
  const color = pct >= 90 ? 'text-red-400' : pct >= 60 ? 'text-yellow-400' : 'text-yt-muted';
  return (
    <span
      className={`text-xs tabular-nums ${color}`}
      title="Estimativa de unidades da YouTube API usadas hoje (reset à meia-noite, horário do Pacífico)"
    >
      ~{used.toLocaleString('pt-BR')} / {QUOTA_DAILY_LIMIT.toLocaleString('pt-BR')}
    </span>
  );
}
