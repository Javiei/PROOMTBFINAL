// src/components/Factura.js
import React, { forwardRef } from "react";

/**
 * Factura de SALIDA (entrega al cliente)
 * Uso: <Factura data={bike} />
 * - data: objeto bicicleta (id, clientName, clientLastName, phoneNumber, bikeBrand, bikeModel, descripcion, comentario, numeroFactura, entryDate, status)
 */
function FacturaBase({ data }) {
  const b = data || {};
  const fecha = new Date().toISOString().slice(0, 10);

  return (
    <div style={{ padding: 24, fontSize: 14, lineHeight: 1.4, width: 700 }}>
      <h1 style={{ margin: 0, fontSize: 22 }}>Comprobante de Entrega</h1>
      <div style={{ color: "#666", marginBottom: 16 }}>Fecha: {fecha}</div>

      <section style={{ marginBottom: 12 }}>
        <strong>Número de factura:</strong> {b.numeroFactura || "—"}
      </section>

      <section style={{ marginBottom: 12 }}>
        <strong>Cliente:</strong> {(b.clientName || "") + " " + (b.clientLastName || "")}
        <br />
        <strong>Teléfono:</strong> {b.phoneNumber || "—"}
      </section>

      <section style={{ marginBottom: 12 }}>
        <strong>Bicicleta:</strong> {b.bikeBrand || "—"} / {b.bikeModel || "—"}
      </section>

      <section style={{ marginBottom: 12 }}>
        <strong>Estado:</strong> {b.status || "—"}
        <br />
        <strong>Comentario:</strong> {b.comentario || "—"}
      </section>

      <section style={{ marginTop: 24 }}>
        <div style={{ height: 80 }} />
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <div>
            ______________________________
            <br />
            Firma del Cliente
          </div>
          <div>
            ______________________________
            <br />
            Firma de Tienda
          </div>
        </div>
      </section>
    </div>
  );
}

export const Factura = forwardRef((props, ref) => <div ref={ref}><FacturaBase {...props} /></div>);
export default Factura;
