import React from 'react';
import { getRoleDisplayName } from '../utils/helpers';

export const LayoutHeader = ({ user, onLogout }) => {
  return (
    <header className="w-full bg-proomtb-dark text-white shadow-lg p-4 flex justify-between items-center sticky top-0 z-10 border-b border-proomtb-light">
      <h1 className="text-2xl font-bold">PROOMTB</h1>
      <div className="flex items-center space-x-4">
        <span className="text-white text-lg">
          Hola, <span className="font-semibold">{user.username}</span> ({getRoleDisplayName(user.role)})
        </span>
        <button
          onClick={onLogout}
          className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition duration-200 shadow-sm"
        >
          Salir
        </button>
      </div>
    </header>
  );
};