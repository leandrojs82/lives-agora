import type { LiveStream } from '../api/types';
import { categoryName, languageName } from '../lib/categories';
import { formatElapsed, formatViewers } from '../lib/format';

export default function LiveCard({ live }: { live: LiveStream }) {
  const href = `https://www.youtube.com/watch?v=${live.videoId}`;
  const lang = languageName(live.language);
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="group block rounded-xl overflow-hidden bg-yt-surface border border-yt-border hover:border-yt-muted transition-colors"
    >
      <div className="relative aspect-video bg-black">
        {live.thumbnailUrl && (
          <img
            src={live.thumbnailUrl}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover group-hover:opacity-90"
          />
        )}
        <span className="absolute top-2 left-2 rounded bg-yt-red px-1.5 py-0.5 text-[11px] font-bold tracking-wide">
          AO VIVO
        </span>
        <div className="absolute bottom-2 right-2 flex gap-1 text-[11px]">
          {live.viewers !== undefined && (
            <span className="rounded bg-black/80 px-1.5 py-0.5">👁 {formatViewers(live.viewers)}</span>
          )}
          {live.startedAt && (
            <span className="rounded bg-black/80 px-1.5 py-0.5">⏱ {formatElapsed(live.startedAt)}</span>
          )}
        </div>
      </div>
      <div className="p-3 space-y-1">
        <h3 className="text-sm font-medium leading-snug line-clamp-2" title={live.title}>
          {live.title}
        </h3>
        <p className="text-xs text-yt-muted truncate">{live.channelTitle}</p>
        <div className="flex flex-wrap gap-1 pt-1">
          <span className="rounded-full bg-yt-border px-2 py-0.5 text-[11px]">{categoryName(live.categoryId)}</span>
          {lang && <span className="rounded-full bg-yt-border px-2 py-0.5 text-[11px]">{lang}</span>}
        </div>
      </div>
    </a>
  );
}
