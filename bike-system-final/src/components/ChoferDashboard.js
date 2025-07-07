import React, { useState, useEffect } from 'react';
import { BikeCard } from './BikeCard';
import { fetchBikes, addBike, updateBike, deleteBike } from '../server/db';
import { getStatusDisplayName } from '../utils/helpers';

export const ChoferDashboard = () => {
  const [bikes, setBikes] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    clientName: '',
    clientLastName: '',
    phoneNumber: '',
    email: '',
    address: '',
    bikeModel: '',
    bikeBrand: '',
  });
  const [filterDate, setFilterDate] = useState('');

  useEffect(() => {
    const loadBikes = async () => {
      const data = await fetchBikes();
      setBikes(data);
    };
    loadBikes();
  }, []);

  // Bicicletas que el chofer debe llevar (status 'chofer')
  const bikesToDeliver = bikes.filter(bike => bike.status === 'chofer');
  // Bicicletas que el chofer debe terminar (status 'listo_chofer')
  const bikesToFinish = bikes.filter(bike => bike.status === 'listo_chofer');

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const handleNewEntry = async () => {
    const { clientName, clientLastName, phoneNumber, email, address, bikeModel, bikeBrand } = formData;
    if (!clientName || !clientLastName || !phoneNumber || !email || !address || !bikeModel || !bikeBrand) {
      alert('¡Échale ganas! Llena todos los campos, por favor.');
      return;
    }

    const newBike = {
      ...formData,
      description: 'Sin descripción inicial', // Descripción por defecto si no se pide
      status: 'chofer', // Se asigna al chofer para que la lleve
      assignedTo: 'chofer1',
      entryDate: new Date().toISOString().split('T')[0], // Fecha de entrada actual
      problem: '', // El campo 'problem' (diagnóstico del mecánico) se inicializa vacío aquí
    };
    const addedBike = await addBike(newBike);
    setBikes([...bikes, addedBike]);
    setFormData({
      clientName: '',
      clientLastName: '',
      phoneNumber: '',
      email: '',
      address: '',
      bikeModel: '',
      bikeBrand: '',
    });
    setShowForm(false);
    alert(`¡Bici de ${clientName} ${clientLastName} registrada con éxito y asignada para llevar!`);
  };

  const handleSendToWash = async (bike) => {
    const updatedBike = { ...bike, status: 'lavado', assignedTo: 'lavador1' };
    const result = await updateBike(updatedBike);
    setBikes(bikes.map(b => b.id === result.id ? result : b));
    alert(`Bicicleta de ${bike.clientName} enviada a Lavado.`);
  };

  const handleFinishProcess = async (bike) => {
    await deleteBike(bike.id);
    setBikes(bikes.filter(b => b.id !== bike.id));
    alert(`Proceso de la bicicleta de ${bike.clientName} terminado. ¡Misión cumplida!`);
  };

  const filteredBikesToDeliver = bikesToDeliver.filter(bike =>
    filterDate ? bike.entryDate === filterDate : true
  );

  const filteredBikesToFinish = bikesToFinish.filter(bike =>
    filterDate ? bike.entryDate === filterDate : true
  );

  // Contadores por estado
  const statusCounts = bikes.reduce((acc, bike) => {
    acc[bike.status] = (acc[bike.status] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <h2 className="text-3xl font-bold text-gray-900 mb-8">Panel del Chofer</h2>

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

      <button
        onClick={() => setShowForm(!showForm)}
        className="mb-6 px-6 py-3 bg-proomtb-dark text-white rounded-xl hover:bg-proomtb-light transition duration-200 shadow-md text-lg font-semibold"
      >
        {showForm ? 'Cerrar Formulario' : 'Registrar Nueva Bicicleta'}
      </button>

      {showForm && (
        <div className="bg-white p-8 rounded-2xl shadow-lg mb-8 border border-gray-200">
          <h3 className="text-2xl font-bold text-gray-900 mb-6">Nueva Entrada de Bicicleta</h3>
          <input
            type="text"
            name="clientName"
            placeholder="Nombre del Cliente"
            className="w-full px-5 py-3 mb-4 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-proomtb-dark transition duration-200"
            value={formData.clientName}
            onChange={handleInputChange}
          />
          <input
            type="text"
            name="clientLastName"
            placeholder="Apellido del Cliente"
            className="w-full px-5 py-3 mb-4 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-proomtb-dark transition duration-200"
            value={formData.clientLastName}
            onChange={handleInputChange}
          />
          <input
            type="text"
            name="phoneNumber"
            placeholder="Número de Teléfono"
            className="w-full px-5 py-3 mb-4 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-proomtb-dark transition duration-200"
            value={formData.phoneNumber}
            onChange={handleInputChange}
          />
          <input
            type="email"
            name="email"
            placeholder="Correo Electrónico"
            className="w-full px-5 py-3 mb-4 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-proomtb-dark transition duration-200"
            value={formData.email}
            onChange={handleInputChange}
          />
          <input
            type="text"
            name="address"
            placeholder="Dirección"
            className="w-full px-5 py-3 mb-4 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-proomtb-dark transition duration-200"
            value={formData.address}
            onChange={handleInputChange}
          />
          <input
            type="text"
            name="bikeModel"
            placeholder="Modelo de Bicicleta"
            className="w-full px-5 py-3 mb-4 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-proomtb-dark transition duration-200"
            value={formData.bikeModel}
            onChange={handleInputChange}
          />
          <input
            type="text"
            name="bikeBrand"
            placeholder="Marca de Bicicleta"
            className="w-full px-5 py-3 mb-4 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-proomtb-dark transition duration-200"
            value={formData.bikeBrand}
            onChange={handleInputChange}
          />
          <button
            onClick={handleNewEntry}
            className="w-full bg-proomtb-dark text-white py-3 rounded-xl hover:bg-proomtb-light transition duration-200 text-lg font-semibold shadow-md"
          >
            Registrar Bicicleta
          </button>
        </div>
      )}

      <div className="mb-6">
        <label htmlFor="filterDate" className="block text-gray-700 text-lg font-semibold mb-2">Filtrar por Fecha de Entrada:</label>
        <input
          type="date"
          id="filterDate"
          className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-proomtb-dark transition duration-200"
          value={filterDate}
          onChange={(e) => setFilterDate(e.target.value)}
        />
      </div>

      <h3 className="text-2xl font-bold text-gray-900 mb-6">Bicicletas por Llevar (Entrada)</h3>
      {filteredBikesToDeliver.length === 0 ? (
        <p className="text-gray-600 text-lg">No hay bicicletas pendientes para llevar. ¡A rodar!</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredBikesToDeliver.map(bike => (
            <BikeCard key={bike.id} bike={bike} onAction={handleSendToWash} actionLabel="Enviar a Lavado" />
          ))}
        </div>
      )}

      <h3 className="text-2xl font-bold text-gray-900 mt-8 mb-6">Bicicletas Listas para Entregar (Proceso Terminado)</h3>
      {filteredBikesToFinish.length === 0 ? (
        <p className="text-gray-600 text-lg">No hay bicicletas listas para terminar el proceso.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredBikesToFinish.map(bike => (
            <BikeCard key={bike.id} bike={bike} onAction={handleFinishProcess} actionLabel="Terminar Proceso" />
          ))}
        </div>
      )}
    </div>
  );
};
