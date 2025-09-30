import React, { useEffect, useMemo, useRef, useState, forwardRef } from "react";
import { useReactToPrint } from "react-to-print";

/* ==== Mini componentes INCRUSTADOS (no se guardan aparte) ==== */
const Modal = ({ open, title, onClose, children, footer }) => {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white w-full max-w-3xl rounded-xl shadow-lg">
        <div className="px-4 py-3 border-b flex justify-between items-center">
          <h3 className="font-semibold">{title}</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-black">✕</button>
        </div>
        <div className="p-4 max-h-[70vh] overflow-auto">{children}</div>
        {footer && <div className="px-4 py-3 border-t bg-gray-50">{footer}</div>}
      </div>
    </div>
  );
};

const CommentsPanel = ({ bikeId }) => {
  const [items, setItems] = useState([]);
  const [body, setBody] = useState("");

  const load = () => {
    fetch(`/api/bikes/${bikeId}/comments`)
      .then(r => r.json())
      .then(setItems)
      .catch(console.error);
  };

  useEffect(() => { if (bikeId) load(); }, [bikeId]);

  const add = async () => {
    if (!body.trim()) return;
    const res = await fetch(`/api/bikes/${bikeId}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body })
    });
    if (res.ok) {
      setBody("");
      load();
    }
  };

  return (
    <div>
      <h4 className="font-semibold mb-2">Comentarios</h4>
      <div className="space-y-2 mb-3">
        {items.map(c => (
          <div key={c.id} className="border rounded p-2">
            <div className="text-xs text-gray-500">
              {c.author || 'tienda'} — {new Date(c.createdAt).toLocaleString()}
            </div>
            <div className="whitespace-pre-wrap">{c.body}</div>
          </div>
        ))}
        {!items.length && <div className="text-sm text-gray-500">Sin comentarios</div>}
      </div>
      <div className="flex gap-2">
        <textarea
          className="flex-1 border rounded p-2" rows={2}
          placeholder="Escribe un comentario…"
          value={body} onChange={e => setBody(e.target.value)}
        />
        <button onClick={add} className="px-3 py-2 bg-black text-white rounded">Agregar</button>
      </div>
    </div>
  );
};

// Plantillas de impresión incrustadas
const FacturaEntrada = forwardRef(({ bike }) => (
  <div className="p-8 text-sm">
    <h2 className="text-xl font-bold mb-4">Recibo de Entrada</h2>
    <div>Factura: {bike?.numeroFactura || '—'}</div>
    <div>Cliente: {(bike?.clientName || '') + ' ' + (bike?.clientLastName || '')}</div>
    <div>Tel: {bike?.phoneNumber || '—'}</div>
    <div>Marca/Modelo: {bike?.bikeBrand} / {bike?.bikeModel}</div>
    <div>Descripción: {bike?.description}</div>
    <div>Problema: {bike?.problem}</div>
    <div>Fecha: {String(bike?.entryDate || '').slice(0,10)}</div>
  </div>
));
const FacturaSalida = forwardRef(({ bike }) => (
  <div className="p-8 text-sm">
    <h2 className="text-xl font-bold mb-4">Entrega / Salida</h2>
    <div>Factura: {bike?.numeroFactura || '—'}</div>
    <div>Cliente: {(bike?.clientName || '') + ' ' + (bike?.clientLastName || '')}</div>
    <div>Entrega estado: {bike?.status}</div>
    <div>Comentario: {bike?.comentario || '—'}</div>
    <div>Fecha: {new Date().toISOString().slice(0,10)}</div>
  </div>
));

const StatusCard = ({ label, count, onClick, active }) => (
  <button
    onClick={onClick}
    className={`px-4 py-3 rounded-xl shadow border text-left ${
      active ? 'bg-black text-white' : 'bg-white hover:bg-gray-50'
    }`}
  >
    <div className="text-xs uppercase text-gray-500">{label}</div>
    <div className="text-2xl font-bold">{count ?? 0}</div>
  </button>
);

/* ==== Dashboard de Tienda (todo conectado a la DB) ==== */
export default function TiendaDashboard() {
  const [stats, setStats] = useState([]);
  const [rows, setRows] = useState([]);
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState(""); // '', 'listo_tienda','tienda','terminado'
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState(null);

  // refs para imprimir
  const entradaWrap = useRef(null);
  const salidaWrap  = useRef(null);
  const printEntrada = useReactToPrint({ content: () => entradaWrap.current });
  const printSalida  = useReactToPrint({ content: () => salidaWrap.current });

  const load = async () => {
    const [a, b] = await Promise.all([
      fetch("/api/bikes/tienda/stats").then(r => r.json()),
      fetch("/api/bikes/tienda").then(r => r.json()),
    ]);
    setStats(a);
    setRows(b);
  };
  useEffect(() => { load(); }, []);

  const counts = useMemo(() => {
    const m = Object.fromEntries(stats.map(s => [s.status, s.count]));
    return {
      listo_tienda: m['listo_tienda'] || 0,
      tienda: m['tienda'] || 0,
      terminado: m['terminado'] || 0,
      total: (m['listo_tienda']||0)+(m['tienda']||0)+(m['terminado']||0)
    };
  }, [stats]);

  const filtered = useMemo(() => {
    let data = rows;
    if (statusFilter) data = data.filter(x => x.status === statusFilter);
    if (q.trim()) {
      const k = q.toLowerCase();
      data = data.filter(x =>
        String(x.id).includes(k) ||
        (x.clientName||'').toLowerCase().includes(k) ||
        (x.clientLastName||'').toLowerCase().includes(k) ||
        (x.phoneNumber||'').toLowerCase().includes(k) ||
        (x.bikeBrand||'').toLowerCase().includes(k) ||
        (x.bikeModel||'').toLowerCase().includes(k)
      );
    }
    return data;
  }, [rows, q, statusFilter]);

  const openRow = async (row) => {
    const fresh = await fetch(`/api/bikes/${row.id}`).then(r => r.json());
    setCurrent(fresh);
    setOpen(true);
  };

  const save = async () => {
    const payload = {
      clientName: current.clientName,
      clientLastName: current.clientLastName,
      phoneNumber: current.phoneNumber,
      email: current.email,
      address: current.address,
      bikeModel: current.bikeModel,
      bikeBrand: current.bikeBrand,
      description: current.description,
      problem: current.problem,
      assignedTo: current.assignedTo,
      status: current.status,
      entryDate: String(current.entryDate || '').slice(0,10),
      comentario: current.comentario,
      numeroFactura: current.numeroFactura
    };
    const res = await fetch(`/api/bikes/${current.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    if (res.ok) {
      setOpen(false);
      load();
    } else {
      alert('Error guardando');
    }
  };

  return (
    <div className="p-4 space-y-4">
      {/* Header + filtros */}
      <div className="flex flex-wrap gap-3 items-end">
        <div className="text-2xl font-bold">Tienda</div>
        <div className="ml-auto flex gap-2">
          <StatusCard label="Listo tienda" count={counts.listo_tienda}
            active={statusFilter==='listo_tienda'}
            onClick={() => setStatusFilter(s => s==='listo_tienda' ? '' : 'listo_tienda')} />
          <StatusCard label="En tienda" count={counts.tienda}
            active={statusFilter==='tienda'}
            onClick={() => setStatusFilter(s => s==='tienda' ? '' : 'tienda')} />
          <StatusCard label="Terminados" count={counts.terminado}
            active={statusFilter==='terminado'}
            onClick={() => setStatusFilter(s => s==='terminado' ? '' : 'terminado')} />
          <StatusCard label="Total" count={counts.total}
            active={!statusFilter} onClick={() => setStatusFilter('')} />
        </div>
        <input
          className="border rounded px-3 py-2 w-full md:w-80"
          placeholder="Buscar por cliente, tel, marca, modelo, ID…"
          value={q} onChange={e=>setQ(e.target.value)}
        />
      </div>

      {/* Tabla */}
      <div className="border rounded overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-100">
            <tr>
              <th className="p-2 text-left">ID</th>
              <th className="p-2 text-left">Cliente</th>
              <th className="p-2 text-left">Teléfono</th>
              <th className="p-2 text-left">Bicicleta</th>
              <th className="p-2 text-left">Estado</th>
              <th className="p-2 text-left">Fecha</th>
              <th className="p-2 text-left">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(b => (
              <tr key={b.id} className="border-t hover:bg-gray-50">
                <td className="p-2">{b.id}</td>
                <td className="p-2">{(b.clientName||'') + ' ' + (b.clientLastName||'')}</td>
                <td className="p-2">{b.phoneNumber}</td>
                <td className="p-2">{b.bikeBrand} / {b.bikeModel}</td>
                <td className="p-2">{b.status}</td>
                <td className="p-2">{String(b.entryDate||'').slice(0,10)}</td>
                <td className="p-2">
                  <button onClick={()=>openRow(b)} className="px-2 py-1 rounded bg-black text-white">
                    Abrir
                  </button>
                </td>
              </tr>
            ))}
            {!filtered.length && (
              <tr><td className="p-4 text-center text-gray-500" colSpan={7}>Sin resultados</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Modal detalle (edición + comentarios + imprimir) */}
      <Modal
        open={open}
        title={current ? `Bici #${current.id}` : 'Detalle'}
        onClose={()=>setOpen(false)}
        footer={
          <div className="flex gap-2 justify-end">
            <button className="px-4 py-2 rounded border" onClick={()=>setOpen(false)}>Cancelar</button>
            <button className="px-4 py-2 rounded bg-black text-white" onClick={save}>Guardar</button>
          </div>
        }
      >
        {current && (
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="font-semibold">Cliente</div>
              <input className="border p-2 w-full" value={current.clientName||''}
                onChange={e=>setCurrent({...current, clientName:e.target.value})} placeholder="Nombre" />
              <input className="border p-2 w-full" value={current.clientLastName||''}
                onChange={e=>setCurrent({...current, clientLastName:e.target.value})} placeholder="Apellido" />
              <input className="border p-2 w-full" value={current.phoneNumber||''}
                onChange={e=>setCurrent({...current, phoneNumber:e.target.value})} placeholder="Teléfono" />
              <input className="border p-2 w-full" value={current.address||''}
                onChange={e=>setCurrent({...current, address:e.target.value})} placeholder="Dirección" />
              <input className="border p-2 w-full" value={current.email||''}
                onChange={e=>setCurrent({...current, email:e.target.value})} placeholder="Email" />
            </div>

            <div className="space-y-2">
              <div className="font-semibold">Bicicleta</div>
              <input className="border p-2 w-full" value={current.bikeBrand||''}
                onChange={e=>setCurrent({...current, bikeBrand:e.target.value})} placeholder="Marca" />
              <input className="border p-2 w-full" value={current.bikeModel||''}
                onChange={e=>setCurrent({...current, bikeModel:e.target.value})} placeholder="Modelo" />
              <textarea className="border p-2 w-full" rows={2} value={current.description||''}
                onChange={e=>setCurrent({...current, description:e.target.value})} placeholder="Descripción" />
              <textarea className="border p-2 w-full" rows={2} value={current.problem||''}
                onChange={e=>setCurrent({...current, problem:e.target.value})} placeholder="Problema" />
              <div className="flex gap-2">
                <select className="border p-2 w-full" value={current.status||''}
                  onChange={e=>setCurrent({...current, status:e.target.value})}>
                  {['listo_tienda','tienda','terminado','delivery','ruta'].map(s =>
                    <option key={s} value={s}>{s}</option>
                  )}
                </select>
                <input type="date" className="border p-2"
                  value={String(current.entryDate||'').slice(0,10)}
                  onChange={e=>setCurrent({...current, entryDate:e.target.value})}/>
              </div>
              <input className="border p-2 w-full" value={current.numeroFactura||''}
                onChange={e=>setCurrent({...current, numeroFactura:e.target.value})} placeholder="Número de factura / nota" />
              <textarea className="border p-2 w-full" rows={2} value={current.comentario||''}
                onChange={e=>setCurrent({...current, comentario:e.target.value})} placeholder="Comentario" />
            </div>

            {/* Acciones: imprimir */}
            <div className="md:col-span-2 flex flex-wrap gap-2 items-center">
              <button onClick={printEntrada} className="px-3 py-2 rounded border">Imprimir Entrada</button>
              <button onClick={printSalida} className="px-3 py-2 rounded border">Imprimir Salida</button>
            </div>

            {/* wraps ocultos para imprimir (contenido incrustado) */}
            <div className="hidden">
              <div ref={entradaWrap}><FacturaEntrada bike={current} /></div>
              <div ref={salidaWrap}><FacturaSalida  bike={current} /></div>
            </div>

            {/* Comentarios incrustados */}
            <div className="md:col-span-2">
              <CommentsPanel bikeId={current.id} />
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
