'use client';

import { FormEvent, useEffect, useState } from 'react';

export default function LoginPage() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [next, setNext] = useState('/');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const value = params.get('next') || '/';
    setNext(value.startsWith('/') && !value.startsWith('//') ? value : '/');
  }, []);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ password }),
      });

      if (!res.ok) {
        setError(res.status === 401 ? 'That password did not make her blush.' : 'Login is sulking. Try again.');
        return;
      }

      window.location.assign(next);
    } catch {
      setError('Login tripped over its own shoelaces.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="login-shell">
      <div className="login-stars" />
      <form className="login-card" onSubmit={onSubmit}>
        <p className="login-kicker">waifu checkpoint</p>
        <h1>Say the password.</h1>
        <p className="login-copy">No more invite links. One shared password gets you into the rizz deck.</p>
        <input
          autoFocus
          aria-label="Password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="password"
          type="password"
        />
        <button disabled={loading || !password.trim()} type="submit">
          {loading ? 'checking...' : 'enter'}
        </button>
        {error ? <p className="login-error">{error}</p> : null}
      </form>
    </main>
  );
}
