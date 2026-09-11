import { useAuth } from './auth/useAuth';
import LoginPage from './pages/LoginPage';

export default function App() {
  const auth = useAuth();

  if (auth.status !== 'signedIn') {
    return (
      <LoginPage onSignIn={auth.signIn} error={auth.error} loading={auth.status === 'loading'} />
    );
  }

  return (
    <main className="p-6 space-y-4">
      <p>Logado como {auth.user?.name} ({auth.user?.email})</p>
      <button type="button" className="underline" onClick={auth.signOut}>
        Sair
      </button>
    </main>
  );
}
