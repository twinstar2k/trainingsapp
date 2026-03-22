import { useState } from 'react';
import { signOutUser } from '../services/auth';
import { useAuth } from '../context/AuthContext';

export const HomePage: React.FC = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogout = async () => {
    setLoading(true);
    setError(null);
    try {
      await signOutUser();
    } catch {
      setError('Abmeldung fehlgeschlagen.');
      setLoading(false);
    }
  };

  if (!user) return null;

  return (
    <div className="home-page">
      <h1>Hallo {user.displayName ?? 'Unbekannt'}</h1>
      <p><strong>E-Mail:</strong> {user.email}</p>
      <p><strong>UID:</strong> {user.uid}</p>
      {error && <p className="home-page__error" role="alert">{error}</p>}
      <button
        className="home-page__button"
        onClick={handleLogout}
        disabled={loading}
        aria-busy={loading}
      >
        {loading ? 'Wird abgemeldet…' : 'Abmelden'}
      </button>
    </div>
  );
};
