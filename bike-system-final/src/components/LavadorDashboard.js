import React, { useState, useEffect } from 'react';
import { BikeCard } from './BikeCard';
import { fetchBikes, updateBike } from '../server/db';
import { getStatusDisplayName } from '../utils/helpers';

export const LavadorDashboard = () => {
  const [bikes, setBikes] = useState([]);

  useEffect(() => {
    const loadBikes = async () => {
      const data = await fetchBikes();
      setBikes(data);
    };
    loadBikes();
  }, []);

  const lavadoBikes = bikes.filter(bike => bike.status === 'lavado');

  const handleSendToQuote = async (bike) => {
    const updatedBike = { ...bike, status: 'por cotizar', assignedTo: 'mecanico1' };
    const result = await updateBike(updatedBike);
    setBikes(bikes.map(b => b.id === result.id ? result : b));
    alert(`Bicicleta de ${bike.clientName} enviada a Cotizar.`);
  };

  // Contadores por estado
  const statusCounts = bikes.reduce((acc, bike) => {
    acc[bike.status] = (acc[bike.status] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <h2 className="text-3xl font-bold text-gray-900 mb-8">Panel del Lavador</h2>

      <div className="mb-8">
        <h3 className="text-2xl font-bold text-gray-900 mb-4">Contadores por Estado</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {Object.entries(statusCounts).map(([status, count]) => (
            <div key={status} className="bg-white p-4 rounded-xl shadow-md text-center">
              <p className="text-gray-600 text-sm">{getStatusDisplayName(status)}</p>
              <p className="text-2xl font-bold text-gray-900">{count}</p>
            </div>
          ))}
        </div>
      </div>

      <h3 className="text-2xl font-bold text-gray-900 mb-6">Bicicletas para Lavar</h3>
      {lavadoBikes.length === 0 ? (
        <p className="text-gray-600 text-lg">No hay bicicletas pendientes de lavado. ¡A brillar!</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {lavadoBikes.map(bike => (
            <BikeCard key={bike.id} bike={bike} onAction={handleSendToQuote} actionLabel="Enviar a Cotizar" />
          ))}
        </div>
      )}
    </div>
  );
};