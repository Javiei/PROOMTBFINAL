import React, { useState, useEffect } from 'react';
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
    fetch('/api/bikes')
      .then(res => res.json())
      .then(data => setBikes(data))
      .catch(err => console.error('Error al obtener bicicletas:', err));
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
    if (!editingBike) return;
    try {
      const response = await fetch(`/api/bikes/${editingBike.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...editingBike, ...formData }),
      });
      const updated = await response.json();
      setBikes(bikes.map(b => (b.id === updated.id ? updated : b)));
      setEditingBike(null);
      alert('Bicicleta actualizada correctamente');
    } catch (error) {
      console.error('Error al actualizar bicicleta:', error);
      alert('Error al actualizar la bicicleta');
    }
  };

  const handleDeleteBike = async (bikeId) => {
    if (!window.confirm('¿Estás seguro de eliminar esta bicicleta?')) return;
    try {
      await fetch(`/api/bikes/${bikeId}`, { method: 'DELETE' });
      setBikes(bikes.filter(b => b.id !== bikeId));
    } catch (error) {
      console.error('Error al eliminar bicicleta:', error);
      alert('Error al eliminar bicicleta');
    }
  };

  const statusCounts = bikes.reduce((acc, bike) => {
    acc[bike.status] = (acc[bike.status] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <h2 className="text-3xl font-bold mb-8">Panel de Administrador</h2>

      <div className="mb-8">
        <h3 className="text-2xl font-bold mb-4">Contadores por Estado</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {Object.entries(statusCounts).map(([status, count]) => (
            <div key={status} className="bg-white p-4 rounded-xl shadow-md text-center">
              <p className="text-gray-600 text-sm">{getStatusDisplayName(status)}</p>
              <p className="text-2xl font-bold text-gray-900">{count}</p>
            </div>
          ))}
        </div>
      </div>

      <h3 className="text-2xl font-bold mb-6">Todas las Bicicletas</h3>
      {bikes.length === 0 ? (
        <p>No hay bicicletas registradas.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {bikes.map(bike => (
            <div key={bike.id} className="bg-white p-6 rounded-2xl shadow-lg border flex flex-col justify-between">
              <div>
                <div className="inline-block px-3 py-1 mb-3 rounded-full bg-gray-200 text-sm">
                  {getStatusDisplayName(bike.status)}
                </div>
                <h3 className="text-xl font-semibold">{bike.clientName} {bike.clientLastName}</h3>
                <p className="text-sm">Modelo: {bike.bikeModel} / Marca: {bike.bikeBrand}</p>
                <p className="text-sm mb-2">Problema: {bike.description}</p>
                {bike.problem && <p className="text-sm font-medium">Diagnóstico: {bike.problem}</p>}
                {bike.entryDate && <p className="text-xs text-gray-500">Entrada: {bike.entryDate}</p>}
              </div>
              <div className="flex flex-col space-y-2 mt-4">
                <button
                  onClick={() => handleEditClick(bike)}
                  className="w-full bg-black text-white py-2 rounded-xl hover:bg-gray-800"
                >
                  Editar
                </button>
                <button
                  onClick={() => handleDeleteBike(bike.id)}
                  className="w-full bg-red-600 text-white py-2 rounded-xl hover:bg-red-700"
                >
                  Eliminar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {editingBike && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white p-8 rounded-xl w-full max-w-lg">
            <h3 className="text-2xl font-bold mb-6">Editar Bicicleta</h3>
            {[
              ['clientName', 'Nombre del Cliente'],
              ['clientLastName', 'Apellido del Cliente'],
              ['phoneNumber', 'Teléfono'],
              ['email', 'Correo'],
              ['address', 'Dirección'],
              ['bikeModel', 'Modelo'],
              ['bikeBrand', 'Marca'],
            ].map(([name, placeholder]) => (
              <input
                key={name}
                name={name}
                placeholder={placeholder}
                value={formData[name]}
                onChange={handleInputChange}
                className="w-full px-5 py-3 mb-4 border border-gray-300 rounded-xl"
              />
            ))}
            <textarea
              name="description"
              placeholder="Descripción del Problema"
              value={formData.description}
              onChange={handleInputChange}
              className="w-full px-5 py-3 mb-4 border border-gray-300 rounded-xl"
            />
            <textarea
              name="problem"
              placeholder="Diagnóstico del Mecánico"
              value={formData.problem}
              onChange={handleInputChange}
              className="w-full px-5 py-3 mb-4 border border-gray-300 rounded-xl"
            />
            <select
              name="status"
              value={formData.status}
              onChange={handleInputChange}
              className="w-full px-5 py-3 mb-6 border border-gray-300 rounded-xl"
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
            <div className="flex justify-end gap-4">
              <button
                onClick={() => setEditingBike(null)}
                className="bg-gray-300 px-6 py-3 rounded-xl"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveEdit}
                className="bg-black text-white px-6 py-3 rounded-xl"
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
