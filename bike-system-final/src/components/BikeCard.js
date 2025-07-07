import React from 'react';
import { getStatusDisplayName } from '../utils/helpers';

export const BikeCard = ({ bike, onAction, showActions = true, actionLabel = 'Acción', children }) => {
  const getStatusColor = (status) => {
    switch (status) {
      case 'chofer': return 'bg-blue-500 text-white'; // Azul PROOMTB
      case 'tienda': return 'bg-green-500 text-white'; // Verde PROOMTB
      case 'lavado': return 'bg-yellow-500 text-white';
      case 'por cotizar': return 'bg-purple-500 text-white';
      case 'en cotizacion': return 'bg-indigo-500 text-white';
      case 'en reparacion': return 'bg-orange-500 text-white';
      case 'listo_chofer': return 'bg-teal-500 text-white';
      case 'listo_tienda': return 'bg-pink-500 text-white';
      default: return 'bg-gray-500 text-white';
    }
  };

  return (
    <div className="bg-white p-6 rounded-2xl shadow-lg border border-gray-200 flex flex-col justify-between h-full">
      <div>
        <div className={`inline-block px-3 py-1 rounded-full text-sm font-semibold mb-3 ${getStatusColor(bike.status)}`}>
          {getStatusDisplayName(bike.status)}
        </div>
        <h3 className="text-xl font-semibold text-gray-900 mb-2">{bike.clientName} {bike.clientLastName}</h3>
        <p className="text-gray-600 text-sm mb-2">Modelo: {bike.bikeModel} / Marca: {bike.bikeBrand}</p>
        <p className="text-gray-600 text-sm mb-4">Problema: {bike.description}</p>
        {bike.problem && <p className="text-gray-800 text-sm font-medium mb-4">Diagnóstico: {bike.problem}</p>}
        {bike.entryDate && <p className="text-gray-500 text-xs">Fecha de Entrada: {bike.entryDate}</p>}
      </div>
      {showActions && (
        <button
          onClick={() => onAction(bike)}
          className="w-full bg-proomtb-dark text-white py-2 rounded-xl hover:bg-proomtb-light transition duration-200 text-md font-medium shadow-md mt-4"
        >
          {actionLabel}
        </button>
      )}
      {children}
    </div>
  );
};