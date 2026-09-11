import { useState } from 'react';
import type { AuthUser } from '../auth/googleAuth';
import QuotaBadge from './QuotaBadge';

interface Props {
  user: AuthUser;
  quotaUsed: number;
  reloadingSubs: boolean;
  onReloadSubscriptions: () => void;
  onSignOut: () => void;
}

export default function Header({ user, quotaUsed, reloadingSubs, onReloadSubscriptions, onSignOut }: Props) {
  const [open, setOpen] = useState(false);
  return (
    <header className="sticky top-0 z-30 bg-yt-bg/95 backdrop-blur border-b border-yt-border">
      <div className="mx-auto max-w-7xl px-4 h-14 flex items-center gap-3">
        <span className="h-7 w-7 rounded-full bg-yt-red flex items-center justify-center text-xs">▶</span>
        <h1 className="font-semibold text-lg">Lives Agora</h1>
        <div className="ml-auto flex items-center gap-3">
          <QuotaBadge used={quotaUsed} />
          <div className="relative">
            <button
              type="button"
              onClick={() => setOpen((o) => !o)}
              className="h-8 w-8 rounded-full overflow-hidden border border-yt-border"
              aria-label="Menu do usuário"
            >
              {user.picture ? (
                <img src={user.picture} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
              ) : (
                <span className="text-sm">{user.name.charAt(0)}</span>
              )}
            </button>
            {open && (
              <div
                className="absolute right-0 mt-2 w-56 rounded-lg bg-yt-surface border border-yt-border shadow-xl py-1 text-sm"
                onMouseLeave={() => setOpen(false)}
              >
                <div className="px-3 py-2 border-b border-yt-border">
                  <div className="font-medium truncate">{user.name}</div>
                  <div className="text-xs text-yt-muted truncate">{user.email}</div>
                </div>
                <button
                  type="button"
                  disabled={reloadingSubs}
                  onClick={() => {
                    setOpen(false);
                    onReloadSubscriptions();
                  }}
                  className="w-full text-left px-3 py-2 hover:bg-yt-border disabled:opacity-50"
                >
                  {reloadingSubs ? 'Recarregando inscrições…' : 'Recarregar inscrições'}
                </button>
                <button
                  type="button"
                  onClick={onSignOut}
                  className="w-full text-left px-3 py-2 hover:bg-yt-border text-red-300"
                >
                  Sair
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
