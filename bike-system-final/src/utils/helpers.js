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
    // ==== Ciclo general ====
    case 'por cotizar':
      return 'Por Cotizar';
    case 'en cotizacion':
      return 'En Cotización';
    case 'en reparacion':
      return 'En Reparación';
    case 'listo_tienda':
      return 'Listo para Tienda';
    case 'listo_chofer':
      return 'Listo para Chofer';
    case 'listo_admin':
      return 'Listo para Administrador';

    // ==== Flujos de trabajo ====
    case 'tienda':
      return 'En Tienda';
    case 'lavado':
      return 'En Lavado';
    case 'chofer':
      return 'En Chofer';
    case 'mecanico':
      return 'En Mecánico';
    case 'admin':
      return 'En Administración';

    // ==== Finales / especiales ====
    case 'terminado':
      return 'Terminados';
    case 'entregada':
      return 'Entregada';
    case 'garantia':
      return 'Garantía';

    // ==== Por compatibilidad ====
    case 'nuevo':
      return 'Nuevo Ingreso';
    case 'cancelado':
      return 'Cancelado';
    case 'eliminado':
      return 'Eliminado';

    default:
      return 'Desconocido';
  }
};
