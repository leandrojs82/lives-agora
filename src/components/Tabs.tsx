export type TabKey = 'subscribed' | 'discover';

interface Props {
  active: TabKey;
  counts: Record<TabKey, number>;
  onChange: (t: TabKey) => void;
}

const LABELS: Record<TabKey, string> = { subscribed: 'Inscritos', discover: 'Descoberta' };

export default function Tabs({ active, counts, onChange }: Props) {
  return (
    <nav className="flex gap-6 border-b border-yt-border px-4 mx-auto max-w-7xl" role="tablist">
      {(Object.keys(LABELS) as TabKey[]).map((key) => {
        const isActive = key === active;
        return (
          <button
            key={key}
            role="tab"
            type="button"
            aria-selected={isActive}
            onClick={() => onChange(key)}
            className={`py-3 text-sm font-medium border-b-2 -mb-px transition-colors ${
              isActive ? 'border-white text-white' : 'border-transparent text-yt-muted hover:text-white'
            }`}
          >
            {LABELS[key]} <span className="text-yt-muted">({counts[key]})</span>
          </button>
        );
      })}
    </nav>
  );
}
