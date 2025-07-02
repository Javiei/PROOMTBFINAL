export const getRoleDisplayName = (role) => {
  switch (role) {
    case 'chofer':
      return 'Chofer';
    case 'tienda':
      return 'Tienda';
    case 'lavador':
      return 'Lavador';
    case 'mecanico':
      return 'Mecánico';
    case 'admin':
      return 'Administrador';
    default:
      return 'Desconocido';
  }
};

export const getStatusDisplayName = (status) => {
  switch (status) {
    case 'chofer':
      return 'En Chofer';
    case 'tienda':
      return 'En Tienda';
    case 'lavado':
      return 'En Lavado';
    case 'por cotizar':
      return 'Por Cotizar';
    case 'en cotizacion':
      return 'En Cotización';
    case 'en reparacion':
      return 'En Reparación';
    case 'listo_chofer':
      return 'Listo para Chofer';
    case 'listo_tienda':
      return 'Listo para Tienda';
    default:
      return 'Desconocido';
  }
};