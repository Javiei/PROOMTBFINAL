import React, { useState } from 'react';
import { AuthLoginForm } from './components/AuthLoginForm';
import { LayoutHeader } from './components/LayoutHeader';
import { ChoferDashboard } from './components/ChoferDashboard';
import { TiendaDashboard } from './components/TiendaDashboard';
import { LavadorDashboard } from './components/LavadorDashboard';
import { MecanicoDashboard } from './components/MecanicoDashboard';
import { AdminDashboard } from './components/AdminDashboard';

function App() {
  const [user, setUser] = useState(null);

  const handleLogin = (loggedInUser) => {
    setUser(loggedInUser);
  };

  const handleLogout = () => {
    setUser(null);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Definir colores de PROOMTB en el CSS global o en un archivo de configuración de Tailwind */}
      <style>{`
        .bg-proomtb-dark { background-color: #000000; } /* Negro */
        .bg-proomtb-light { background-color: #333333; } /* Gris oscuro */
        .text-proomtb-dark { color: #000000; }
        .text-proomtb-light { color: #333333; }
        .focus\\:ring-proomtb-dark:focus { --tw-ring-color: #000000; }
      `}</style>
      {!user ? (
        <AuthLoginForm onLogin={handleLogin} />
      ) : (
        <>
          <LayoutHeader user={user} onLogout={handleLogout} />
          <main className="container mx-auto px-4 py-8">
            {user.role === 'chofer' && <ChoferDashboard />}
            {user.role === 'tienda' && <TiendaDashboard />}
            {user.role === 'lavador' && <LavadorDashboard />}
            {user.role === 'mecanico' && <MecanicoDashboard />}
            {user.role === 'admin' && <AdminDashboard />}
          </main>
        </>
      )}
    </div>
  );
}

export default App;