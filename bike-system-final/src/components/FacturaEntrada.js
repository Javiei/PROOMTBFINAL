// src/components/FacturaEntrada.js
import React, { forwardRef } from "react";

/**
 * Factura de ENTRADA (recepción en tienda)
 * Uso: <FacturaEntrada bike={bike} />
 */
function FacturaEntradaBase({ bike }) {
  const b = bike || {};
  const fecha = (b.entryDate && String(b.entryDate).slice(0, 10)) || new Date().toISOString().slice(0, 10);

  return (
    <div style={{ padding: 24, fontSize: 14, lineHeight: 1.4, width: 700 }}>
      <h1 style={{ margin: 0, fontSize: 22 }}>Recibo de Entrada</h1>
      <div style={{ color: "#666", marginBottom: 16 }}>Fecha: {fecha}</div>

      <section style={{ marginBottom: 12 }}>
        <strong>Número de factura:</strong> {b.numeroFactura || "—"}
      </section>

      <section style={{ marginBottom: 12 }}>
        <strong>Cliente:</strong> {(b.clientName || "") + " " + (b.clientLastName || "")}
        <br />
        <strong>Teléfono:</strong> {b.phoneNumber || "—"}
        <br />
        <strong>Dirección:</strong> {b.address || "—"}
      </section>

      <section style={{ marginBottom: 12 }}>
        <strong>Bicicleta:</strong> {b.bikeBrand || "—"} / {b.bikeModel || "—"}
        <br />
        <strong>Descripción:</strong> {b.description || "—"}
        <br />
        <strong>Problema:</strong> {b.problem || "—"}
      </section>

      <section style={{ marginTop: 24 }}>
        <div style={{ height: 80 }} />
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <div>
            ______________________________
            <br />
            Firma del Cliente (Recepción)
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

export const FacturaEntrada = forwardRef((props, ref) => <div ref={ref}><FacturaEntradaBase {...props} /></div>);
export default FacturaEntrada;
