// src/components/AuthLoginForm.js
import React, { useState } from 'react';

export function AuthLoginForm({ onLogin }) {   // ← NAMED EXPORT
  const [identifier, setIdentifier] = useState('');   // cambiamos username → identifier
  const [password, setPassword] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ identifier, password }), // backend espera 'identifier'
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(err?.error || 'Credenciales incorrectas');
        return;
      }

      const user = await res.json();
      onLogin?.(user);
    } catch (err) {
      console.error('[AuthLoginForm] login error', err);
      alert('Error de red');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="max-w-sm mx-auto mt-10 p-4 border rounded-lg">
      <h2 className="text-xl font-bold mb-4 text-center">Iniciar sesión</h2>

      <label className="block text-sm mb-1">Usuario</label>
      <input
        className="w-full border rounded px-3 py-2 mb-3"
        value={identifier}
        onChange={(e) => setIdentifier(e.target.value)}
        placeholder="usuario"
        autoComplete="username"
      />

      <label className="block text-sm mb-1">Contraseña</label>
      <input
        type="password"
        className="w-full border rounded px-3 py-2 mb-4"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="••••••••"
        autoComplete="current-password"
      />

      <button
        type="submit"
        className="w-full bg-black hover:bg-gray-800 text-white rounded py-2 transition"
      >
        Entrar
      </button>
    </form>
  );
}

// (opcional) export default también para tolerar ambos imports:
export default AuthLoginForm;
