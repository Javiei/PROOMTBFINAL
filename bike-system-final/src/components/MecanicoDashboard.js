import React, { useState, useEffect } from 'react';
import { BikeCard } from './BikeCard';
import { fetchBikes, updateBike } from '../server/db';
import { getStatusDisplayName } from '../utils/helpers';

export const MecanicoDashboard = () => {
  const [bikes, setBikes] = useState([]);
  const [selectedBike, setSelectedBike] = useState(null);
  const [problemDescription, setProblemDescription] = useState('');

  useEffect(() => {
    const loadBikes = async () => {
      const data = await fetchBikes();
      setBikes(data);
    };
    loadBikes();
  }, []);

  const porCotizarBikes = bikes.filter(bike => bike.status === 'por cotizar');
  const enCotizacionBikes = bikes.filter(bike => bike.status === 'en cotizacion');
  const enReparacionBikes = bikes.filter(bike => bike.status === 'en reparacion');

  const handleSelectBikeForProblem = (bike) => {
    setSelectedBike(bike);
    setProblemDescription(bike.problem || '');
  };

  const handleSaveProblem = async () => {
    if (selectedBike) {
      const updatedBike = { ...selectedBike, problem: problemDescription };
      const result = await updateBike(updatedBike);
      setBikes(bikes.map(b => b.id === result.id ? result : b));
      setSelectedBike(null);
      setProblemDescription('');
      alert(`Problema de la bicicleta de ${selectedBike.clientName} guardado.`);
    }
  };

  const handleStatusChange = async (bike, newStatus) => {
    const updatedBike = { ...bike, status: newStatus };
    const result = await updateBike(updatedBike);
    setBikes(bikes.map(b => b.id === result.id ? result : b));
    alert(`Bicicleta de ${bike.clientName} ahora en: ${getStatusDisplayName(newStatus)}`);
  };

  const handleSendToFinalDestination = async (bike, destination) => {
    const newStatus = destination === 'chofer' ? 'listo_chofer' : 'listo_tienda';
    const updatedBike = { ...bike, status: newStatus, assignedTo: destination === 'chofer' ? 'chofer1' : 'tienda1' };
    const result = await updateBike(updatedBike);
    setBikes(bikes.map(b => b.id === result.id ? result : b));
    alert(`Bicicleta de ${bike.clientName} enviada a: ${getStatusDisplayName(newStatus)}`);
  };

  // Contadores por estado
  const statusCounts = bikes.reduce((acc, bike) => {
    acc[bike.status] = (acc[bike.status] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <h2 className="text-3xl font-bold text-gray-900 mb-8">Panel del Mecánico</h2>

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

      {selectedBike && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white p-8 rounded-2xl shadow-2xl w-full max-w-md">
            <h3 className="text-2xl font-bold text-gray-900 mb-6">Diagnosticar Problema</h3>
            <p className="text-gray-700 mb-4">Bicicleta de: {selectedBike.clientName} {selectedBike.clientLastName}</p>
            <textarea
              placeholder="Describe el problema y la solución..."
              rows="6"
              className="w-full px-5 py-3 mb-6 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-proomtb-dark transition duration-200 resize-none"
              value={problemDescription}
              onChange={(e) => setProblemDescription(e.target.value)}
            ></textarea>
            <div className="flex justify-end space-x-4">
              <button
                onClick={() => setSelectedBike(null)}
                className="px-6 py-3 bg-gray-300 text-gray-800 rounded-xl hover:bg-gray-400 transition duration-200 font-semibold"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveProblem}
                className="px-6 py-3 bg-proomtb-dark text-white rounded-xl hover:bg-proomtb-light transition duration-200 font-semibold"
              >
                Guardar Diagnóstico
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="mb-10">
        <h3 className="text-2xl font-semibold text-gray-800 mb-6">Bicicletas Por Cotizar</h3>
        {porCotizarBikes.length === 0 ? (
          <p className="text-gray-600 text-lg">No hay bicicletas pendientes de cotización. ¡A chambear!</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {porCotizarBikes.map(bike => (
              <BikeCard key={bike.id} bike={bike} showActions={false}>
                <div className="flex flex-col space-y-2 mt-4">
                  <button
                    onClick={() => handleSelectBikeForProblem(bike)}
                    className="w-full bg-blue-600 text-white py-2 rounded-xl hover:bg-blue-700 transition duration-200 text-md font-medium shadow-md"
                  >
                    Diagnosticar Problema
                  </button>
                  <button
                    onClick={() => handleStatusChange(bike, 'en cotizacion')}
                    className="w-full bg-indigo-600 text-white py-2 rounded-xl hover:bg-indigo-700 transition duration-200 text-md font-medium shadow-md"
                  >
                    Mover a En Cotización
                  </button>
                  <button
                    onClick={() => handleStatusChange(bike, 'en reparacion')}
                    className="w-full bg-orange-600 text-white py-2 rounded-xl hover:bg-orange-700 transition duration-200 text-md font-medium shadow-md"
                  >
                    Mover a En Reparación
                  </button>
                </div>
              </BikeCard>
            ))}
          </div>
        )}
      </div>

      <div className="mb-10">
        <h3 className="text-2xl font-semibold text-gray-800 mb-6">Bicicletas En Cotización</h3>
        {enCotizacionBikes.length === 0 ? (
          <p className="text-gray-600 text-lg">No hay bicicletas en cotización.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {enCotizacionBikes.map(bike => (
              <BikeCard key={bike.id} bike={bike} showActions={false}>
                <div className="flex flex-col space-y-2 mt-4">
                  <button
                    onClick={() => handleStatusChange(bike, 'en reparacion')}
                    className="w-full bg-orange-600 text-white py-2 rounded-xl hover:bg-orange-700 transition duration-200 text-md font-medium shadow-md"
                  >
                    Mover a En Reparación
                  </button>
                  <button
                    onClick={() => handleSendToFinalDestination(bike, 'chofer')}
                    className="w-full bg-teal-600 text-white py-2 rounded-xl hover:bg-teal-700 transition duration-200 text-md font-medium shadow-md"
                  >
                    Enviar a Chofer (Lista)
                  </button>
                  <button
                    onClick={() => handleSendToFinalDestination(bike, 'tienda')}
                    className="w-full bg-pink-600 text-white py-2 rounded-xl hover:bg-pink-700 transition duration-200 text-md font-medium shadow-md"
                  >
                    Enviar a Tienda (Lista)
                  </button>
                </div>
              </BikeCard>
            ))}
          </div>
        )}
      </div>

      <div>
        <h3 className="text-2xl font-semibold text-gray-800 mb-6">Bicicletas En Reparación</h3>
        {enReparacionBikes.length === 0 ? (
          <p className="text-gray-600 text-lg">No hay bicicletas en reparación.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {enReparacionBikes.map(bike => (
              <BikeCard key={bike.id} bike={bike} showActions={false}>
                <div className="flex flex-col space-y-2 mt-4">
                  <button
                    onClick={() => handleSendToFinalDestination(bike, 'chofer')}
                    className="w-full bg-teal-600 text-white py-2 rounded-xl hover:bg-teal-700 transition duration-200 text-md font-medium shadow-md"
                  >
                    Enviar a Chofer (Lista)
                  </button>
                  <button
                    onClick={() => handleSendToFinalDestination(bike, 'tienda')}
                    className="w-full bg-pink-600 text-white py-2 rounded-xl hover:bg-pink-700 transition duration-200 text-md font-medium shadow-md"
                  >
                    Enviar a Tienda (Lista)
                  </button>
                </div>
              </BikeCard>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};