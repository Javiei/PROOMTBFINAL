import React, { useEffect, useState } from 'react';

const ChoferDashboard = () => {
  const [bikes, setBikes] = useState([]);

  useEffect(() => {
    fetch('/api/bikes')
      .then(res => res.json())
      .then(data => setBikes(data))
      .catch(err => console.error("Error al cargar bicicletas:", err));
  }, []);

  return (
    <div>
      <h2 className="text-xl font-bold mb-4">Bicicletas asignadas al chofer</h2>
      <ul>
        {bikes.map(bike => (
          <li key={bike.id}>{bike.brand} - {bike.model} ({bike.status})</li>
        ))}
      </ul>
    </div>
  );
};

export { ChoferDashboard };
