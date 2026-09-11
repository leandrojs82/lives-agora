interface Props {
  onSignIn: () => void;
  error: string | null;
  loading: boolean;
}

export default function LoginPage({ onSignIn, error, loading }: Props) {
  return (
    <main className="min-h-full flex items-center justify-center p-6">
      <div className="w-full max-w-sm rounded-2xl bg-yt-surface border border-yt-border p-8 text-center space-y-6">
        <div className="space-y-2">
          <div className="mx-auto h-14 w-14 rounded-full bg-yt-red flex items-center justify-center text-2xl">
            ▶
          </div>
          <h1 className="text-2xl font-semibold">Lives Agora</h1>
          <p className="text-yt-muted text-sm">
            Veja só o que está ao vivo agora nos canais que você segue.
          </p>
        </div>

        <button
          type="button"
          onClick={onSignIn}
          disabled={loading}
          className="w-full rounded-lg bg-white text-black font-medium py-3 hover:bg-gray-200 disabled:opacity-50"
        >
          {loading ? 'Carregando…' : 'Entrar com Google'}
        </button>

        {error && <p className="text-sm text-red-400">{error}</p>}

        <p className="text-xs text-yt-muted">
          Acesso somente leitura (youtube.readonly). Nenhum dado sai do seu navegador.
        </p>
      </div>
    </main>
  );
}
