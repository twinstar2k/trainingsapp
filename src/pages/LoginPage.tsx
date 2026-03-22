import { useState } from 'react';
import { signInWithGoogle } from '../services/auth';

export const LoginPage: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async () => {
    setLoading(true);
    setError(null);
    try {
      await signInWithGoogle();
    } catch (err) {
      setError('Anmeldung fehlgeschlagen. Bitte erneut versuchen.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <h1>Trainingsapp</h1>
      {error && <p className="login-page__error" role="alert">{error}</p>}
      <button
        className="login-page__button"
        onClick={handleLogin}
        disabled={loading}
        aria-busy={loading}
      >
        {loading ? 'Wird angemeldet…' : 'Mit Google anmelden'}
      </button>
    </div>
  );
};
