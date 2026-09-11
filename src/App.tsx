import { useAuth } from './auth/useAuth';
import LoginPage from './pages/LoginPage';
import Dashboard from './pages/Dashboard';

export default function App() {
  const auth = useAuth();

  if (auth.status !== 'signedIn' || !auth.user) {
    return (
      <LoginPage onSignIn={auth.signIn} error={auth.error} loading={auth.status === 'loading'} />
    );
  }

  return <Dashboard user={auth.user} onSignOut={auth.signOut} />;
}
