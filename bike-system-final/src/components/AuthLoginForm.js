import React, { useState } from 'react';

const AuthLoginForm = ({ onLogin }) => {
  const [userId, setUserId] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();

    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, password }),
    });

    if (res.ok) {
      const user = await res.json();
      onLogin(user);
    } else {
      alert('Credenciales incorrectas');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="max-w-sm mx-auto mt-10 p-4 border rounded bg-white">
      <h2 className="text-xl mb-4">Iniciar sesión</h2>
      <input
        type="text"
        placeholder="Usuario"
        value={userId}
        onChange={(e) => setUserId(e.target.value)}
        className="w-full mb-2 p-2 border"
      />
      <input
        type="password"
        placeholder="Contraseña"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        className="w-full mb-4 p-2 border"
      />
      <button type="submit" className="bg-black text-white px-4 py-2 rounded">Entrar</button>
    </form>
  );
};

export { AuthLoginForm };
