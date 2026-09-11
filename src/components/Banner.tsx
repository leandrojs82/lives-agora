import type { ReactNode } from 'react';

const styles = {
  error: 'bg-red-950/60 border-red-800 text-red-200',
  warning: 'bg-yellow-950/60 border-yellow-800 text-yellow-100',
  info: 'bg-yt-surface border-yt-border text-yt-muted',
} as const;

export default function Banner({ kind, children }: { kind: keyof typeof styles; children: ReactNode }) {
  return <div className={`rounded-lg border px-4 py-3 text-sm ${styles[kind]}`}>{children}</div>;
}
