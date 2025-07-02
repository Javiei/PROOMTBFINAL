import React, { useState, useEffect } from 'react';
import { fetchBikes, updateBike, deleteBike } from '../server/db';
import { getStatusDisplayName } from '../utils/helpers';

export const AdminDashboard = () => {
  const [bikes, setBikes] = useState([]);
  const [editingBike, setEditingBike] = useState(null);
  const [formData, setFormData] = useState({
    clientName: '',
    clientLastName: '',
    phoneNumber: '',
    email: '',
    address: '',
    bikeModel: '',
    bikeBrand: '',
    description: '',
    status: '',
    problem: '',
  });

  useEffect(() => {
    const loadBikes = async () => {
      const data = await fetchBikes();
      setBikes(data);
    };
    loadBikes();
  }, []);

  const handleEditClick = (bike) => {
    setEditingBike(bike);
    setFormData({
      clientName: bike.clientName,
      clientLastName: bike.clientLastName,
      phoneNumber: bike.phoneNumber,
      email: bike.email,
      address: bike.address,
      bikeModel: bike.bikeModel,
      bikeBrand: bike.bikeBrand,
      description: bike.description,
      status: bike.status,
      problem: bike.problem,
    });
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const handleSaveEdit = async () => {
    if (editingBike) {
      const updatedBike = { ...editingBike, ...formData };
      const result = await updateBike(updatedBike);
      setBikes(bikes.map(b => b.id === result.id ? result : b));
      setEditingBike(null);
      alert(`Bicicleta de ${result.clientName} actualizada.`);
    }
  };

  const handleDeleteBike = async (bikeId) => {
    if (window.confirm('¿Estás seguro de que quieres eliminar esta bicicleta? ¡No hay vuelta atrás!')) {
      await deleteBike(bikeId);
      setBikes(bikes.filter(bike => bike.id !== bikeId));
      alert('Bicicleta eliminada con éxito.');
    }
  };

  // Contadores por estado
  const statusCounts = bikes.reduce((acc, bike) => {
    acc[bike.status] = (acc[bike.status] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <h2 className="text-3xl font-bold text-gray-900 mb-8">Panel de Administrador</h2>

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

      <h3 className="text-2xl font-bold text-gray-900 mb-6">Todas las Bicicletas</h3>
      {bikes.length === 0 ? (
        <p className="text-gray-600 text-lg">No hay bicicletas registradas.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {bikes.map(bike => (
            <div key={bike.id} className="bg-white p-6 rounded-2xl shadow-lg border border-gray-200 flex flex-col justify-between">
              <div>
                <div className={`inline-block px-3 py-1 rounded-full text-sm font-semibold mb-3 ${getStatusDisplayName(bike.status).toLowerCase().replace(/\s/g, '-')}`}>
                  {getStatusDisplayName(bike.status)}
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">{bike.clientName} {bike.clientLastName}</h3>
                <p className="text-gray-600 text-sm mb-2">Modelo: {bike.bikeModel} / Marca: {bike.bikeBrand}</p>
                <p className="text-gray-600 text-sm mb-4">Problema Inicial: {bike.description}</p>
                {bike.problem && <p className="text-gray-800 text-sm font-medium mb-4">Diagnóstico: {bike.problem}</p>}
                {bike.entryDate && <p className="text-gray-500 text-xs">Fecha de Entrada: {bike.entryDate}</p>}
              </div>
              <div className="flex flex-col space-y-2 mt-4">
                <button
                  onClick={() => handleEditClick(bike)}
                  className="w-full bg-proomtb-dark text-white py-2 rounded-xl hover:bg-proomtb-light transition duration-200 text-md font-medium shadow-md"
                >
                  Editar
                </button>
                <button
                  onClick={() => handleDeleteBike(bike.id)}
                  className="w-full bg-red-600 text-white py-2 rounded-xl hover:bg-red-700 transition duration-200 text-md font-medium shadow-md"
                >
                  Eliminar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {editingBike && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white p-8 rounded-2xl shadow-2xl w-full max-w-lg">
            <h3 className="text-2xl font-bold text-gray-900 mb-6">Editar Bicicleta</h3>
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
            <textarea
              name="description"
              placeholder="Descripción del Problema Inicial"
              rows="4"
              className="w-full px-5 py-3 mb-4 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-proomtb-dark transition duration-200 resize-none"
              value={formData.description}
              onChange={handleInputChange}
            ></textarea>
            <textarea
              name="problem"
              placeholder="Diagnóstico del Mecánico"
              rows="4"
              className="w-full px-5 py-3 mb-4 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-proomtb-dark transition duration-200 resize-none"
              value={formData.problem}
              onChange={handleInputChange}
            ></textarea>
            <select
              name="status"
              className="w-full px-5 py-3 mb-6 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-proomtb-dark transition duration-200"
              value={formData.status}
              onChange={handleInputChange}
            >
              <option value="">Seleccionar Estado</option>
              <option value="chofer">En Chofer</option>
              <option value="tienda">En Tienda</option>
              <option value="lavado">En Lavado</option>
              <option value="por cotizar">Por Cotizar</option>
              <option value="en cotizacion">En Cotización</option>
              <option value="en reparacion">En Reparación</option>
              <option value="listo_chofer">Listo para Chofer</option>
              <option value="listo_tienda">Listo para Tienda</option>
            </select>
            <div className="flex justify-end space-x-4">
              <button
                onClick={() => setEditingBike(null)}
                className="px-6 py-3 bg-gray-300 text-gray-800 rounded-xl hover:bg-gray-400 transition duration-200 font-semibold"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveEdit}
                className="px-6 py-3 bg-proomtb-dark text-white rounded-xl hover:bg-proomtb-light transition duration-200 font-semibold"
              >
                Guardar Cambios
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};