import { useState } from 'react';
import type { Filters } from '../api/types';
import { CATEGORIES, LANGUAGES, REGIONS } from '../lib/categories';

interface Props {
  filters: Filters;
  onChange: (f: Filters) => void;
  onRefresh: () => void;
  refreshing: boolean;
  showRemoteSearch: boolean;
  onRemoteSearch?: () => void;
  remoteSearching?: boolean;
  disabled?: boolean;
}

const selectCls =
  'rounded-md bg-yt-surface border border-yt-border px-2 py-2 text-sm disabled:opacity-40 disabled:cursor-not-allowed';

export default function FilterBar({
  filters,
  onChange,
  onRefresh,
  refreshing,
  showRemoteSearch,
  onRemoteSearch,
  remoteSearching = false,
  disabled = false,
}: Props) {
  const [open, setOpen] = useState(false);
  const set = (patch: Partial<Filters>) => onChange({ ...filters, ...patch });

  const selects = (
    <>
      <select
        className={selectCls}
        value={filters.categoryId ?? ''}
        onChange={(e) => set({ categoryId: e.target.value || null })}
        aria-label="Categoria"
      >
        <option value="">Todas as categorias</option>
        {CATEGORIES.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>

      <select
        className={selectCls}
        value={filters.language ?? ''}
        onChange={(e) => set({ language: e.target.value || null })}
        aria-label="Idioma"
      >
        <option value="">Todos os idiomas</option>
        {LANGUAGES.map((l) => (
          <option key={l.code} value={l.code}>
            {l.name}
          </option>
        ))}
      </select>

      <select
        className={selectCls}
        value={filters.region ?? ''}
        onChange={(e) => set({ region: e.target.value || null })}
        disabled={!showRemoteSearch}
        title={
          showRemoteSearch
            ? 'Região só se aplica ao botão "Buscar no YouTube"'
            : 'Região só está disponível na aba Descoberta (busca remota)'
        }
        aria-label="Região"
      >
        <option value="">Todas as regiões</option>
        {REGIONS.map((r) => (
          <option key={r.code} value={r.code}>
            {r.name}
          </option>
        ))}
      </select>
    </>
  );

  return (
    <div className="sticky top-14 z-20 bg-yt-bg/95 backdrop-blur border-b border-yt-border">
      <div className="mx-auto max-w-7xl px-4 py-3 flex flex-wrap items-center gap-2">
        <input
          type="search"
          value={filters.query}
          onChange={(e) => set({ query: e.target.value })}
          placeholder="Buscar por título ou canal…"
          className="flex-1 min-w-[180px] rounded-md bg-yt-surface border border-yt-border px-3 py-2 text-sm"
          aria-label="Busca"
        />

        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="sm:hidden rounded-md border border-yt-border px-3 py-2 text-sm"
          aria-expanded={open}
        >
          Filtros
        </button>

        <button
          type="button"
          onClick={onRefresh}
          disabled={refreshing || disabled}
          className="rounded-md bg-yt-surface border border-yt-border px-3 py-2 text-sm hover:bg-yt-border disabled:opacity-50"
        >
          {refreshing ? 'Atualizando…' : 'Atualizar'}
        </button>

        {showRemoteSearch && (
          <button
            type="button"
            onClick={onRemoteSearch}
            disabled={remoteSearching || disabled}
            className="rounded-md bg-yt-red px-3 py-2 text-sm font-medium hover:bg-red-600 disabled:opacity-50"
            title="Faz uma busca na API do YouTube com os filtros atuais (custa 100 unidades de cota)"
          >
            {remoteSearching ? 'Buscando…' : 'Buscar no YouTube'}{' '}
            <span className="text-xs opacity-80">100 un.</span>
          </button>
        )}

        <div
          className={`${open ? 'flex' : 'hidden'} sm:flex w-full sm:w-auto flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-1 sm:pt-0`}
        >
          {selects}
        </div>
      </div>
    </div>
  );
}
