// src/components/TiendaDashboard.js
import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
} from "react";
import { useReactToPrint } from "react-to-print";
import { getStatusDisplayName } from "../utils/helpers";
import { Factura } from "./Factura";               // SALIDA (entrega)
import { FacturaEntrada } from "./FacturaEntrada"; // ENTRADA (recepción)

/* ========= Helper: base URL + fetch seguro ========= */
const RAW_API = process.env.REACT_APP_API_URL || "";
const API = RAW_API.endsWith("/") ? RAW_API.slice(0, -1) : RAW_API;

async function fetchJSON(path, options = {}) {
  const url = path.startsWith("http") ? path : `${API}${path}`;
  const res = await fetch(url, {
    headers: { Accept: "application/json", ...(options.headers || {}) },
    credentials: "include",
    ...options,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    const err = new Error(`${res.status} ${res.statusText} – ${text.slice(0, 200)}`);
    err.status = res.status;
    err.body = text;
    throw err;
  }
  const ct = res.headers.get("content-type") || "";
  if (!ct.includes("application/json")) return {};
  return res.json();
}

/* ========= Estados visibles en TIENDA ========= */
const STATUS_FOR_TIENDA = ["listo_tienda", "tienda", "terminado"];

/* ========= Helpers de clientes ========= */
const clientKeyFromBike = (b) =>
  (b?.phoneNumber && `tel:${b.phoneNumber}`) ||
  (b?.email && `mail:${b.email}`) ||
  `${b?.clientName || ""}|${b?.clientLastName || ""}`;

function deriveClientsFromBikes(bikes) {
  const map = new Map();
  for (const b of bikes) {
    const key = clientKeyFromBike(b);
    if (!map.has(key)) {
      map.set(key, {
        id: key,
        name: b.clientName || "",
        lastName: b.clientLastName || "",
        phone: b.phoneNumber || "",
        email: b.email || "",
        address: b.address || "",
      });
    }
  }
  return Array.from(map.values());
}

/* ========= Estilos de impresión SOLO para facturas ========= */
function PrintStyles() {
  return (
    <style>
      {`
        @media print {
          @page { size: auto; margin: 12mm; }

          .print-area, .print-area * {
            background: #fff !important;
            color: #000 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            box-shadow: none !important;
          }

          .print-area .page-break { page-break-after: always; }
        }
      `}
    </style>
  );
}

/* =============================== COMPONENTE =============================== */
export default function TiendaDashboard() {
  // Datos
  const [stats, setStats] = useState([]);
  const [bikes, setBikes] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  // Registro
  const [registroModo, setRegistroModo] = useState(null); // 'nuevo' | 'existente' | null
  const [selectedClient, setSelectedClient] = useState(null);
  const [searchClientQuery, setSearchClientQuery] = useState("");
  const defaultForm = {
    clientName: "",
    clientLastName: "",
    phoneNumber: "",
    email: "",
    address: "",
    bikeModel: "",
    bikeBrand: "",
    description: "",
    problem: "",
  };
  const [formData, setFormData] = useState(defaultForm);

  // UI
  const [searchBike, setSearchBike] = useState("");
  const [statusModal, setStatusModal] = useState(null); // { status, bikes, search }
  const [sendingLavadoId, setSendingLavadoId] = useState(null);

  // EDITAR (solo status "tienda")
  const [editModal, setEditModal] = useState(null); // { bikeId, temp }

  // Facturas (referencias + datos)
  const entradaRef = useRef(null);
  const salidaRef = useRef(null);
  const [facturaEntradaData, setFacturaEntradaData] = useState(null);
  const [facturaSalidaData, setFacturaSalidaData] = useState(null);

  // react-to-print v3: usar contentRef
  const printEntrada = useReactToPrint({ contentRef: entradaRef, documentTitle: "Factura Entrada" });
  const printSalida  = useReactToPrint({ contentRef: salidaRef,  documentTitle: "Factura Salida"  });

  // Cuando hay datos de factura y el nodo ya existe, imprimimos
  useEffect(() => {
    if (!facturaEntradaData) return;
    const t = setTimeout(() => { if (entradaRef.current) printEntrada?.(); }, 50);
    return () => clearTimeout(t);
  }, [facturaEntradaData, printEntrada]);

  useEffect(() => {
    if (!facturaSalidaData) return;
    const t = setTimeout(() => { if (salidaRef.current) printSalida?.(); }, 50);
    return () => clearTimeout(t);
  }, [facturaSalidaData, printSalida]);

  /* ===================== CARGA INICIAL ===================== */
  const load = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const [s, b] = await Promise.all([
        fetchJSON("/api/bikes/tienda/stats"),
        fetchJSON("/api/bikes/tienda"),
      ]);

      const bikesNorm = (Array.isArray(b) ? b : []).map((x) => ({ ...x }));
      setStats(Array.isArray(s) ? s : []);
      setBikes(bikesNorm);
      setClients(deriveClientsFromBikes(bikesNorm));
    } catch (e) {
      console.error("Error al obtener datos:", e);
      setLoadError("No se pudieron cargar los datos de Tienda.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  /* ====================== CONTADORES ===================== */
  const counts = useMemo(() => {
    const m = Object.fromEntries(stats.map(s => [s.status, s.count]));
    return {
      listo_tienda: m["listo_tienda"] || 0,
      tienda: m["tienda"] || 0,
      terminado: m["terminado"] || 0,
      total: (m["listo_tienda"] || 0) + (m["tienda"] || 0) + (m["terminado"] || 0),
    };
  }, [stats]);

  /* ====================== FILTROS ===================== */
  const filteredBikes = useMemo(() => {
    const k = searchBike.toLowerCase();
    return bikes.filter((b) =>
      `${b.clientName} ${b.clientLastName} ${b.bikeBrand} ${b.bikeModel} ${b.id}`
        .toLowerCase()
        .includes(k)
    );
  }, [bikes, searchBike]);

  const filteredClients = useMemo(() => {
    const k = searchClientQuery.toLowerCase();
    return clients.filter((c) =>
      `${c.name} ${c.lastName} ${c.phone}`.toLowerCase().includes(k)
    );
  }, [clients, searchClientQuery]);

  const bikesEnTienda = useMemo(
    () => filteredBikes.filter((b) => b.status === "tienda"),
    [filteredBikes]
  );
  const bikesListas = useMemo(
    () => filteredBikes.filter((b) => b.status === "listo_tienda"),
    [filteredBikes]
  );
  const bikesTerminadas = useMemo(
    () => filteredBikes.filter((b) => b.status === "terminado"),
    [filteredBikes]
  );

  /* =============================== REGISTRO =============================== */
  const handleInput = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleNewEntry = async () => {
    const {
      clientName,
      clientLastName,
      phoneNumber,
      email,
      address,
      bikeModel,
      bikeBrand,
      description,
      problem,
    } = formData;

    if (registroModo === "nuevo") {
      if (!clientName || !clientLastName || !phoneNumber || !bikeModel || !bikeBrand) {
        return alert("Completa los campos de cliente y bicicleta requeridos.");
      }
    }
    if (registroModo === "existente") {
      if (!selectedClient || !bikeModel || !bikeBrand) {
        return alert("Selecciona un cliente y completa la bicicleta.");
      }
    }

    const dataCliente =
      registroModo === "existente"
        ? {
            clientName: selectedClient?.name || "",
            clientLastName: selectedClient?.lastName || "",
            phoneNumber: selectedClient?.phone || "",
            email: selectedClient?.email || "",
            address: selectedClient?.address || "",
          }
        : { clientName, clientLastName, phoneNumber, email, address };

    const newBike = {
      ...dataCliente,
      bikeModel,
      bikeBrand,
      description,
      problem,
      status: "tienda",
      entryDate: new Date().toISOString().slice(0, 10),
    };

    try {
      const created = await fetchJSON("/api/bikes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newBike),
      });

      const facturaEntrada = {
        ...(created || newBike),
        invoiceNumber: created?.invoiceNumber || created?.numeroFactura || newBike.invoiceNumber || newBike.numeroFactura || "",
        numeroFactura:  created?.numeroFactura || created?.invoiceNumber || newBike.numeroFactura || newBike.invoiceNumber || "",
      };

      setFacturaEntradaData(facturaEntrada);

      alert("Bicicleta registrada en TIENDA.");
      setRegistroModo(null);
      setSelectedClient(null);
      setFormData(defaultForm);
      load();
    } catch (e) {
      console.error(e);
      alert("No se pudo registrar la bicicleta en Tienda.");
    }
  };

  /* =============================== ACCIONES =============================== */
  const enviarALavado = async (bike) => {
    if (!bike?.id) return;
    try {
      setSendingLavadoId(bike.id);
      setBikes((prev) => prev.map((b) => (b.id === bike.id ? { ...b, status: "lavado" } : b)));
      await fetchJSON(`/api/bikes/${bike.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "lavado" }),
      });
      load();
      alert("Bicicleta enviada a Lavado.");
    } catch (e) {
      console.error(e);
      setBikes((prev) => prev.map((b) => (b.id === bike.id ? { ...b, status: bike.status } : b)));
      alert("No se pudo enviar a Lavado.");
    } finally {
      setSendingLavadoId(null);
    }
  };

  const marcarListoTienda = async (bike) => {
    try {
      await fetchJSON(`/api/bikes/${bike.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "listo_tienda" }),
      });
      alert("Marcada como 'Listo en Tienda'.");
      load();
    } catch (e) {
      console.error(e);
      alert("No se pudo actualizar el estado.");
    }
  };

  const entregarAlCliente = async (bike) => {
    const facturaSalida = {
      ...bike,
      invoiceNumber: bike.invoiceNumber || bike.numeroFactura || "",
      numeroFactura: bike.numeroFactura || bike.invoiceNumber || "",
    };
    setFacturaSalidaData(facturaSalida);

    try {
      await fetchJSON(`/api/bikes/${bike.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "terminado" }),
      });
      alert("Bicicleta entregada (status: Terminado).");
      load();
    } catch (e) {
      console.error(e);
      alert("No se pudo marcar como terminado.");
    }
  };

  /* =============================== EDITAR (solo status 'tienda') =============================== */
  const openEditModal = (bike) => {
    // solo permitir si está en "tienda"
    if (bike?.status !== "tienda") return;
    const temp = {
      clientName: bike.clientName || "",
      clientLastName: bike.clientLastName || "",
      phoneNumber: bike.phoneNumber || "",
      email: bike.email || "",
      address: bike.address || "",
      bikeBrand: bike.bikeBrand || "",
      bikeModel: bike.bikeModel || "",
      description: bike.description || "",
      problem: bike.problem || "",
      serialNumber: bike.serialNumber || "",
      invoiceNumber: bike.invoiceNumber || bike.numeroFactura || "",
    };
    setEditModal({ bikeId: bike.id, temp });
  };

  const closeEditModal = () => setEditModal(null);

  const setEditField = (name, value) =>
    setEditModal((p) => ({ ...p, temp: { ...(p?.temp || {}), [name]: value } }));

  const saveEdit = async () => {
    if (!editModal?.bikeId) return;
    try {
      const fresh = await fetchJSON(`/api/bikes/${editModal.bikeId}`);
      const payload = {
        ...fresh,
        ...editModal.temp,
        // normalizar alias de factura
        numeroFactura: editModal.temp.invoiceNumber || fresh.numeroFactura || fresh.invoiceNumber || "",
        invoiceNumber: editModal.temp.invoiceNumber || fresh.invoiceNumber || fresh.numeroFactura || "",
      };
      const updated = await fetchJSON(`/api/bikes/${editModal.bikeId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      setBikes((prev) => prev.map((x) => (x.id === updated.id ? { ...updated } : x)));
      closeEditModal();
      alert("Bicicleta actualizada.");
    } catch (e) {
      console.error(e);
      alert("No se pudo guardar la edición.");
    }
  };

  /* =============================== MODALES =============================== */
  const openStatusModal = (status) => {
    const bikesInStatus = bikes.filter((b) => b.status === status);
    setStatusModal({ status, bikes: bikesInStatus, search: "" });
  };

  const closeModal = useCallback(() => setStatusModal(null), []);
  useEffect(() => {
    if (!statusModal) return;
    const onKey = (e) => e.key === "Escape" && closeModal();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [statusModal, closeModal]);

  /* =============================== UI =============================== */
  if (loading) return <div className="p-6 text-gray-900">Cargando…</div>;

  return (
    <div className="p-6 bg-gray-50 text-gray-900 min-h-screen">
      <div className="flex items-center gap-3 mb-6">
        <h2 className="text-3xl font-bold">Panel de Tienda</h2>
        <button
          onClick={load}
          className="ml-auto px-3 py-1 rounded-lg bg-white hover:bg-gray-50 text-sm border border-gray-300"
          title="Recargar"
          type="button"
        >
          Recargar
        </button>
      </div>

      {!!loadError && (
        <div className="mb-4 p-3 rounded-lg bg-red-50 text-red-700 border border-red-200">
          {loadError}
        </div>
      )}

      {/* Estilos de impresión SOLO facturas */}
      <PrintStyles />

      {/* ======================= REGISTRO ======================= */}
      <div className="mb-8 p-6 rounded-xl border shadow-sm bg-white border-gray-200">
        <h3 className="text-2xl font-bold mb-4">Registrar Entrada (Tienda)</h3>

        {registroModo === null && (
          <div className="flex gap-4">
            <button
              onClick={() => { setRegistroModo("nuevo"); setFormData(defaultForm); }}
              className="bg-green-600 hover:bg-green-700 text-white px-5 py-2 rounded-lg font-semibold"
              type="button"
            >
              Registrar Nuevo Cliente
            </button>
            <button
              onClick={() => setRegistroModo("existente")}
              className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-lg font-semibold"
              type="button"
            >
              Seleccionar Cliente Existente
            </button>
          </div>
        )}

        {registroModo && (
          <button
            onClick={() => { setRegistroModo(null); setSelectedClient(null); setFormData(defaultForm); }}
            className="mt-4 px-4 py-2 rounded-lg bg-white hover:bg-gray-50 border border-gray-300"
            type="button"
          >
            ← Volver
          </button>
        )}

        {registroModo === "nuevo" && (
          <div className="mt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <input name="clientName" value={formData.clientName} onChange={handleInput} className="w-full px-4 py-2 rounded-lg bg-white border border-gray-300" placeholder="Nombre del Cliente*" />
              <input name="clientLastName" value={formData.clientLastName} onChange={handleInput} className="w-full px-4 py-2 rounded-lg bg-white border border-gray-300" placeholder="Apellido del Cliente*" />
              <input name="phoneNumber" value={formData.phoneNumber} onChange={handleInput} className="w-full px-4 py-2 rounded-lg bg-white border border-gray-300" placeholder="Teléfono*" />
              <input name="email" value={formData.email} onChange={handleInput} className="w-full px-4 py-2 rounded-lg bg-white border border-gray-300" placeholder="Correo" />
              <input name="address" value={formData.address} onChange={handleInput} className="w-full px-4 py-2 rounded-lg bg-white border border-gray-300 md:col-span-2" placeholder="Dirección" />
              <input name="bikeBrand" value={formData.bikeBrand} onChange={handleInput} className="w-full px-4 py-2 rounded-lg bg-white border border-gray-300" placeholder="Marca de Bicicleta*" />
              <input name="bikeModel" value={formData.bikeModel} onChange={handleInput} className="w-full px-4 py-2 rounded-lg bg-white border border-gray-300" placeholder="Modelo de Bicicleta*" />
            </div>
            <textarea name="description" value={formData.description} onChange={handleInput} className="w-full mb-4 px-4 py-2 rounded-lg bg-white border border-gray-300" placeholder="Descripción Adicional" />
            <textarea name="problem" value={formData.problem} onChange={handleInput} className="w-full mb-4 px-4 py-2 rounded-lg bg-white border border-gray-300" placeholder="Problema/Motivo de Ingreso" />
            <button onClick={handleNewEntry} className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold" type="button">
              Registrar Bicicleta (Imprime)
            </button>
          </div>
        )}

        {registroModo === "existente" && !selectedClient && (
          <div className="mt-6">
            <h3 className="text-xl font-bold mb-4">Selecciona un Cliente</h3>
            <input
              type="text"
              placeholder="Buscar por nombre o teléfono…"
              className="mb-4 w-full max-w-md px-4 py-2 rounded-lg bg-white border border-gray-300"
              value={searchClientQuery}
              onChange={(e) => setSearchClientQuery(e.target.value)}
            />
            <ul className="space-y-2 max-h-80 overflow-y-auto">
              {filteredClients.map((client) => (
                <li
                  key={client.id}
                  className="p-3 rounded-xl bg-white border border-gray-300 flex justify-between items-center cursor-pointer hover:bg-gray-50"
                  onClick={() => { setSelectedClient(client); setFormData({ ...defaultForm }); }}
                >
                  <div>
                    <strong>{client.name} {client.lastName}</strong> – {client.phone}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        {registroModo === "existente" && selectedClient && (
          <div className="mt-4">
            <h3 className="text-xl font-bold mb-4">
              Registrar Bicicleta para {selectedClient.name} {selectedClient.lastName}
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              <input name="bikeBrand" value={formData.bikeBrand} onChange={handleInput} className="w-full px-4 py-2 rounded-lg bg-white border border-gray-300" placeholder="Marca de Bicicleta*" />
              <input name="bikeModel" value={formData.bikeModel} onChange={handleInput} className="w-full px-4 py-2 rounded-lg bg-white border border-gray-300" placeholder="Modelo de Bicicleta*" />
            </div>
            <textarea name="description" value={formData.description} onChange={handleInput} className="w-full mb-4 px-4 py-2 rounded-lg bg-white border border-gray-300" placeholder="Descripción adicional" />
            <textarea name="problem" value={formData.problem} onChange={handleInput} className="w-full mb-4 px-4 py-2 rounded-lg bg-white border border-gray-300" placeholder="Problema" />
            <button onClick={handleNewEntry} className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold" type="button">
              Registrar Bicicleta (Imprime)
            </button>
          </div>
        )}
      </div>

      {/* ======================= CONTADORES POR ESTADO ======================= */}
      <div className="mb-8">
        <h3 className="text-2xl font-bold mb-4">Contadores por Estado</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-4">
          {STATUS_FOR_TIENDA.map((s) => (
            <button
              key={s}
              onClick={() => openStatusModal(s)}
              className="p-4 rounded-xl shadow-sm text-center transition bg-white border border-gray-200 hover:bg-gray-50"
              type="button"
            >
              <p className="text-gray-600 text-sm font-medium">
                {getStatusDisplayName(s)}
              </p>
              <p className="text-3xl font-bold text-gray-900">
                {s === "listo_tienda" ? counts.listo_tienda
                  : s === "tienda" ? counts.tienda
                  : counts.terminado}
              </p>
            </button>
          ))}
          <div className="p-4 rounded-xl shadow-sm text-center bg-white border border-gray-200">
            <p className="text-gray-600 text-sm font-medium">Total</p>
            <p className="text-3xl font-bold text-gray-900">{counts.total}</p>
          </div>
        </div>
      </div>

      {/* ============================ BUSCADOR ============================ */}
      <div className="mb-6">
        <input
          type="text"
          placeholder="Buscar bicicleta por cliente, marca, modelo o ID…"
          value={searchBike}
          onChange={(e) => setSearchBike(e.target.value)}
          className="mb-4 px-4 py-2 rounded-lg w-full max-w-md bg-white border border-gray-300"
        />
      </div>

      {/* ============================= LISTADOS ============================= */}
      <h3 className="text-2xl font-bold mb-4">En Tienda</h3>
      {bikesEnTienda.length === 0 ? (
        <p className="text-gray-600 mb-8">No hay bicicletas en Tienda.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-10">
          {bikesEnTienda.map((bike) => (
            <div key={bike.id} className="p-6 rounded-2xl shadow-sm border bg-white border-gray-200">
              <div className="flex justify-between items-start">
                <div className="inline-block px-3 py-1 mb-3 rounded-full bg-gray-100 text-sm font-semibold text-gray-700">
                  {getStatusDisplayName(bike.status)}
                </div>
                {/* BOTÓN EDITAR SOLO EN STATUS 'tienda' */}
                <button
                  type="button"
                  onClick={() => openEditModal(bike)}
                  className="px-3 py-1 rounded-lg border border-gray-300 text-sm hover:bg-gray-50"
                  title="Editar datos de la bicicleta (solo en Tienda)"
                >
                  ✎ Editar
                </button>
              </div>
              <h3 className="text-xl font-semibold">
                {bike.clientName} {bike.clientLastName}
              </h3>
              <p className="text-sm text-gray-700">
                Modelo: {bike.bikeModel} / Marca: {bike.bikeBrand}
              </p>
              {bike.description && <p className="text-sm text-gray-700 mb-2">Problema: {bike.description}</p>}
              {bike.entryDate && (
                <p className="text-xs text-gray-500">
                  Entrada: {String(bike.entryDate).slice(0, 10)}
                </p>
              )}

              <div className="flex flex-col gap-2 mt-4">
                <button
                  onClick={() => enviarALavado(bike)}
                  className={`w-full text-white py-2 rounded-xl ${sendingLavadoId === bike.id ? "bg-blue-400 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-700"}`}
                  type="button"
                  disabled={sendingLavadoId === bike.id}
                >
                  {sendingLavadoId === bike.id ? "Enviando..." : "Enviar a Lavado"}
                </button>
                <button
                  onClick={() => marcarListoTienda(bike)}
                  className="w-full bg-white text-gray-900 py-2 rounded-xl border border-gray-300 hover:bg-gray-50"
                  type="button"
                >
                  Marcar "Listo en Tienda"
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <h3 className="text-2xl font-bold mb-4">Listas para Entregar</h3>
      {bikesListas.length === 0 ? (
        <p className="text-gray-600">No hay bicicletas listas para entregar.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-10">
          {bikesListas.map((bike) => (
            <div key={bike.id} className="p-6 rounded-2xl shadow-sm border bg-white border-gray-200">
              <div className="inline-block px-3 py-1 mb-3 rounded-full bg-gray-100 text-sm font-semibold text-gray-700">
                {getStatusDisplayName(bike.status)}
              </div>
              <h3 className="text-xl font-semibold">
                {bike.clientName} {bike.clientLastName}
              </h3>
              <p className="text-sm text-gray-700">
                Modelo: {bike.bikeModel} / Marca: {bike.bikeBrand}
              </p>
              <div className="flex flex-col gap-2 mt-4">
                <button
                  onClick={() => entregarAlCliente(bike)}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-2 rounded-xl"
                  type="button"
                >
                  Entregar al Cliente (Imprime)
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <h3 className="text-2xl font-bold mb-4">Terminadas</h3>
      {bikesTerminadas.length === 0 ? (
        <p className="text-gray-600">No hay bicicletas terminadas.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-10">
          {bikesTerminadas.map((bike) => (
            <div key={bike.id} className="p-6 rounded-2xl shadow-sm border bg-white border-gray-200">
              <div className="inline-block px-3 py-1 mb-3 rounded-full bg-gray-100 text-sm font-semibold text-gray-700">
                {getStatusDisplayName(bike.status)}
              </div>
              <h3 className="text-xl font-semibold">
                {bike.clientName} {bike.clientLastName}
              </h3>
              <p className="text-sm text-gray-700">
                Modelo: {bike.bikeModel} / Marca: {bike.bikeBrand}
              </p>
              {bike.invoiceNumber && (
                <p className="text-xs text-gray-600 mt-1">Fact #: {bike.invoiceNumber}</p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ========================= MODAL: LISTA POR ESTADO ========================= */}
      {statusModal && (
        <div
          className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4"
          onClick={(e) => { if (e.target === e.currentTarget) closeModal(); }}
        >
          <div className="max-w-2xl w-full p-6 rounded-xl shadow-lg overflow-y-auto max-h-[90vh] relative bg-white border border-gray-200">
            <button
              onClick={closeModal}
              className="absolute top-4 right-4 bg-red-600 text-white px-4 py-1 rounded-lg hover:bg-red-700"
              type="button"
            >
              Cerrar
            </button>
            <h3 className="text-xl font-bold mb-2">
              Bicicletas en estado: {getStatusDisplayName(statusModal.status)}
            </h3>
            <input
              type="text"
              placeholder="Buscar por cliente, marca o modelo..."
              className="mb-4 w-full px-4 py-2 rounded-lg bg-white border border-gray-300"
              value={statusModal.search || ""}
              onChange={(e) => setStatusModal({ ...statusModal, search: e.target.value })}
            />
            {statusModal.bikes.filter((b) =>
              `${b.clientName} ${b.clientLastName} ${b.bikeBrand} ${b.bikeModel}`
                .toLowerCase()
                .includes((statusModal.search || "").toLowerCase())
            ).length === 0 ? (
              <p className="text-gray-600">No hay bicicletas que coincidan.</p>
            ) : (
              <ul className="space-y-3">
                {statusModal.bikes
                  .filter((b) =>
                    `${b.clientName} ${b.clientLastName} ${b.bikeBrand} ${b.bikeModel}`
                      .toLowerCase()
                      .includes((statusModal.search || "").toLowerCase())
                  )
                  .map((bike) => (
                    <li key={bike.id} className="p-4 rounded-xl bg-white border border-gray-200">
                      <div className="flex items-center justify-between">
                        <div>
                          <p>
                            <strong>Cliente:</strong> {bike.clientName} {bike.clientLastName}
                          </p>
                          <p>
                            <strong>Marca:</strong> {bike.bikeBrand} | <strong>Modelo:</strong> {bike.bikeModel}
                          </p>
                          <p>
                            <strong>Diagnóstico:</strong> {bike.problem || "No especificado"}
                          </p>
                          <p className="text-xs text-gray-500">
                            Fecha de entrada: {String(bike.entryDate).slice(0, 10)}
                          </p>
                        </div>
                        {statusModal.status === "tienda" && (
                          <button
                            type="button"
                            onClick={() => openEditModal(bike)}
                            className="px-3 py-1 rounded-lg border border-gray-300 text-sm hover:bg-gray-50"
                          >
                            ✎ Editar
                          </button>
                        )}
                      </div>
                    </li>
                  ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {/* ========================= MODAL: EDITAR ========================= */}
      {editModal && (
        <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4" onClick={(e) => { if (e.target === e.currentTarget) closeEditModal(); }}>
          <div className="max-w-3xl w-full p-6 rounded-xl shadow-lg overflow-y-auto max-h-[90vh] relative bg-white border border-gray-200">
            <button onClick={closeEditModal} className="absolute top-4 right-4 bg-red-600 text-white px-4 py-1 rounded-lg hover:bg-red-700" type="button">Cerrar</button>
            <h3 className="text-2xl font-bold mb-4">Editar Bicicleta (solo en Tienda)</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <input value={editModal.temp.serialNumber} onChange={(e) => setEditField("serialNumber", e.target.value)} className="w-full px-4 py-2 rounded-lg bg-white border border-gray-300" placeholder="Serie" />
              <input value={editModal.temp.invoiceNumber} onChange={(e) => setEditField("invoiceNumber", e.target.value)} className="w-full px-4 py-2 rounded-lg bg-white border border-gray-300" placeholder="N° Factura" />
              <textarea value={editModal.temp.description} onChange={(e) => setEditField("description", e.target.value)} className="w-full px-4 py-2 rounded-lg bg-white border border-gray-300 md:col-span-2" placeholder="Descripción" />
              <textarea value={editModal.temp.problem} onChange={(e) => setEditField("problem", e.target.value)} className="w-full px-4 py-2 rounded-lg bg-white border border-gray-300 md:col-span-2" placeholder="Diagnóstico" />
            </div>

            <div className="flex justify-end gap-2 mt-4">
              <button onClick={closeEditModal} type="button" className="px-4 py-2 rounded-lg bg-white border border-gray-300 hover:bg-gray-50">Cancelar</button>
              <button onClick={saveEdit} type="button" className="px-5 py-2 rounded-lg bg-gray-900 text-white">Guardar Cambios</button>
            </div>
          </div>
        </div>
      )}

      {/* ===== Contenedor oculto para imprimir Facturas ===== */}
      <div className="hidden">
        {/* Factura de ENTRADA (Recepción) */}
        <div
          ref={entradaRef}
           style={{ background: "#fff", color: "#000", padding: 0 }}
        >
          {facturaEntradaData && <FacturaEntrada bike={facturaEntradaData} />}
        </div>

        {/* Factura de SALIDA (Entrega) */}
        <div
          ref={salidaRef}
          className="print-area"
          style={{ background: "#fff", color: "#000", padding: 0 }}
        >
          {facturaSalidaData && <Factura bike={facturaSalidaData} />}
        </div>
      </div>
    </div>
  );
}
