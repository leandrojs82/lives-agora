import type { LiveStream } from '../api/types';
import LiveCard from './LiveCard';

interface Props {
  lives: LiveStream[];
  loading: boolean;
  emptyMessage: string;
}

function Skeleton() {
  return (
    <div className="rounded-xl overflow-hidden bg-yt-surface border border-yt-border animate-pulse">
      <div className="aspect-video bg-yt-border" />
      <div className="p-3 space-y-2">
        <div className="h-3 bg-yt-border rounded w-11/12" />
        <div className="h-3 bg-yt-border rounded w-7/12" />
        <div className="h-3 bg-yt-border rounded w-4/12" />
      </div>
    </div>
  );
}

export default function LiveGrid({ lives, loading, emptyMessage }: Props) {
  if (loading && lives.length === 0) {
    return (
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 8 }, (_, i) => (
          <Skeleton key={i} />
        ))}
      </div>
    );
  }
  if (lives.length === 0) {
    return <p className="text-center text-yt-muted py-16">{emptyMessage}</p>;
  }
  return (
    <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {lives.map((l) => (
        <LiveCard key={l.videoId} live={l} />
      ))}
    </div>
  );
}
