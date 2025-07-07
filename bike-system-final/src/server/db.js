// Este archivo simula la conexión a una base de datos MySQL.
// En un entorno real, aquí iría la configuración de tu conexión a MySQL
// usando librerías como 'mysql2' o 'sequelize'.
// Por ahora, usaremos un array en memoria para simular los datos.

let bikesData = [
  { id: 'bike1', clientName: 'Juan Pérez', clientLastName: 'García', phoneNumber: '5512345678', email: 'juan@example.com', address: 'Calle Falsa 123', bikeModel: 'Montaña X', bikeBrand: 'Specialized', description: 'Cadena suelta, frenos flojos', status: 'chofer', assignedTo: 'chofer1', entryDate: '2023-10-26', problem: '' },
  { id: 'bike2', clientName: 'María López', clientLastName: 'Hernández', phoneNumber: '5587654321', email: 'maria@example.com', address: 'Av. Siempre Viva 45', bikeModel: 'Urbana Y', bikeBrand: 'Giant', description: 'Llanta ponchada, luces no encienden', status: 'tienda', assignedTo: 'tienda1', entryDate: '2023-10-25', problem: '' },
  { id: 'bike3', clientName: 'Carlos Ruiz', clientLastName: 'Martínez', phoneNumber: '5511223344', email: 'carlos@example.com', address: 'Blvd. de los Sueños 67', bikeModel: 'Ruta Z', bikeBrand: 'Trek', description: 'Muy sucia, cambios duros', status: 'lavado', assignedTo: 'lavador1', entryDate: '2023-10-24', problem: '' },
  { id: 'bike4', clientName: 'Ana García', clientLastName: 'Rodríguez', phoneNumber: '5599887766', email: 'ana@example.com', address: 'Paseo de la Reforma 89', bikeModel: 'Eléctrica A', bikeBrand: 'Cannondale', description: 'Falla motor, batería no carga', status: 'por cotizar', assignedTo: 'mecanico1', entryDate: '2023-10-23', problem: '' },
  { id: 'bike5', clientName: 'Pedro Gómez', clientLastName: 'Sánchez', phoneNumber: '5544556677', email: 'pedro@example.com', address: 'Calle del Sol 10', bikeModel: 'BMX B', bikeBrand: 'Harley', description: 'Frenos desajustados, asiento roto', status: 'en reparacion', assignedTo: 'mecanico1', entryDate: '2023-10-22', problem: 'Ajuste de frenos y cambio de asiento' },
  { id: 'bike6', clientName: 'Laura Díaz', clientLastName: 'Pérez', phoneNumber: '5533221100', email: 'laura@example.com', address: 'Av. Luna 11', bikeModel: 'Paseo C', bikeBrand: 'Schwinn', description: 'Cambio de asiento, ajuste de manubrio', status: 'en cotizacion', assignedTo: 'mecanico1', entryDate: '2023-10-21', problem: 'Cambio de asiento y ajuste general' },
];

export const fetchBikes = async () => {
  // Simula una llamada a la base de datos
  return new Promise(resolve => setTimeout(() => resolve([...bikesData]), 100));
};

export const addBike = async (newBike) => {
  return new Promise(resolve => {
    setTimeout(() => {
      const id = `bike${bikesData.length + 1}`;
      const bikeWithId = { ...newBike, id };
      bikesData.push(bikeWithId);
      resolve(bikeWithId);
    }, 100);
  });
};

export const updateBike = async (updatedBike) => {
  return new Promise(resolve => {
    setTimeout(() => {
      bikesData = bikesData.map(bike =>
        bike.id === updatedBike.id ? updatedBike : bike
      );
      resolve(updatedBike);
    }, 100);
  });
};

export const deleteBike = async (bikeId) => {
  return new Promise(resolve => {
    setTimeout(() => {
      bikesData = bikesData.filter(bike => bike.id !== bikeId);
      resolve({ success: true });
    }, 100);
  });
};