// src/components/AdminDashboard.js
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useReactToPrint } from "react-to-print";
import { getStatusDisplayName } from "../utils/helpers";
import { Factura } from "./Factura";               // SALIDA
import { FacturaEntrada } from "./FacturaEntrada"; // ENTRADA

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
    throw new Error(`${res.status} ${res.statusText} – ${text.slice(0, 200)}`);
  }
  const ct = res.headers.get("content-type") || "";
  if (!ct.includes("application/json")) return {};
  return res.json();
}

/* ========= Helper: Descargar PDF desde un nodo ========= */
async function downloadPdfFromRef(node, filename = "factura.pdf") {
  if (!node) return;
  const html2canvas = (await import("html2canvas")).default;
  const { jsPDF } = await import("jspdf");

  const canvas = await html2canvas(node, { scale: 2, useCORS: true, backgroundColor: "#fff" });
  const imgData = canvas.toDataURL("image/png");
  const pdf = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
  const pageW = pdf.internal.pageSize.getWidth();
  const margin = 20;
  const imgW = pageW - margin * 2;
  const imgH = (canvas.height * imgW) / canvas.width;

  pdf.addImage(imgData, "PNG", margin, margin, imgW, imgH, undefined, "FAST");
  pdf.save(filename);
}

/* ========= Normalización de llaves de estado/comentarios ========= */
const normalizeStatusKey = (k = "") =>
  k.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

const STATUS_ALIASES = {
  "en cotización": "en cotizacion",
  "en reparación": "en reparacion",
  "por cotización": "por cotizar",
  ingresada: "chofer",
  en_revision: "por cotizar",
  en_reparacion: "en reparacion",
  entregado: "terminado",
  en_cotizacion: "en cotizacion",
  delivery: "tienda",
  ruta: "tienda",
};

function normalizeComments(cmt) {
  if (!cmt) return {};
  if (typeof cmt === "string") {
    try { cmt = JSON.parse(cmt); } catch { return {}; }
  }
  if (typeof cmt !== "object") return {};
  const out = {};
  for (const k of Object.keys(cmt)) {
    const base = normalizeStatusKey(k);
    const nk = STATUS_ALIASES[base] ? STATUS_ALIASES[base] : base;
    out[nk] = cmt[k];
  }
  return out;
}

/* ========= Helpers: derivar clientes desde las bicis ========= */
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

/* ========= Pestañas para comentarios ========= */
const COMMENT_KEYS = [
  "tienda", "mecanico", "admin", "lavado", "chofer",
  "por cotizar", "en cotizacion", "en reparacion",
  "listo_tienda", "listo_chofer", "terminado", "entregada",
];

/* ========= Estados para contadores ========= */
const ALL_STATUSES = [
  "chofer", "tienda", "lavado", "por cotizar", "en cotizacion",
  "en reparacion", "listo_chofer", "listo_tienda", "terminado", "entregada",
  "admin", "mecanico",
];

/* ========= Estado inicial del formulario ========= */
const initialFormDataState = {
  clientName: "", clientLastName: "", phoneNumber: "", email: "", address: "",
  bikeModel: "", bikeBrand: "", description: "", problem: "",
  status: "", invoiceNumber: ""
};

export default function AdminDashboard() {
  // Datos
  const [bikes, setBikes] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);

  // Registro
  const [registroModo, setRegistroModo] = useState(null); // 'nuevo' | 'existente' | null
  const [selectedClient, setSelectedClient] = useState(null);
  const [searchClientQuery, setSearchClientQuery] = useState("");
  const [formData, setFormData] = useState(initialFormDataState);

  // UI general
  const [searchBike, setSearchBike] = useState("");
  const [editingBike, setEditingBike] = useState(null);
  const [clientHistory, setClientHistory] = useState(null);
  const [statusModal, setStatusModal] = useState(null);

  // Comentarios
  const [commentsModal, setCommentsModal] = useState(null);

  // Facturas
  const [facturaEntradaData, setFacturaEntradaData] = useState(null);
  const [facturaSalidaData, setFacturaSalidaData] = useState(null);
  const [mostrarFacturaEntrada, setMostrarFacturaEntrada] = useState(false);
  const [mostrarFacturaSalida, setMostrarFacturaSalida] = useState(false);
  const entradaRef = useRef(null);
  const salidaRef = useRef(null);
  const printEntrada = useReactToPrint({ content: () => entradaRef.current });
  const printSalida = useReactToPrint({ content: () => salidaRef.current });

  const userRole = localStorage.getItem("userRole"); // "admin"

  /* ===================== CARGA INICIAL ===================== */
  useEffect(() => {
    const load = async () => {
      try {
        // ¡IMPORTANTE! Traer TODAS las bicis (no solo tienda)
        const b = await fetchJSON("/api/bikes");
        const bikesNorm = (Array.isArray(b) ? b : []).map((x) => ({
          ...x,
          comments: normalizeComments(x?.comments),
        }));
        setBikes(bikesNorm);
        setClients(deriveClientsFromBikes(bikesNorm));
      } catch (e) {
        console.error("Error al obtener datos:", e);
        alert("No se pudieron cargar datos. Revisa consola/Network.");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  /* ====================== CONTADORES ====================== */
  const statusCounts = useMemo(() => {
    const acc = {};
    ALL_STATUSES.forEach((s) => { acc[s] = 0; });
    for (const b of bikes) {
      const base = normalizeStatusKey(String(b.status || ""));
      const ns = STATUS_ALIASES[base] ? STATUS_ALIASES[base] : base;
      if (acc[ns] !== undefined) acc[ns]++;
    }
    return acc;
  }, [bikes]);

  /* ====================== LISTADO (con búsqueda) ====================== */
  const filteredBikes = useMemo(() => {
    const k = searchBike.toLowerCase().trim();
    if (!k) return bikes;
    return bikes.filter((b) =>
      `${b.clientName} ${b.clientLastName} ${b.bikeBrand} ${b.bikeModel} ${b.id}`
        .toLowerCase()
        .includes(k)
    );
  }, [bikes, searchBike]);

  const filteredClients = useMemo(() => {
    const k = searchClientQuery.toLowerCase();
    return clients.filter(c =>
      `${c.name} ${c.lastName} ${c.phone}`.toLowerCase().includes(k)
    );
  }, [clients, searchClientQuery]);

  /* =============================== REGISTRO =============================== */
  const handleNewEntryInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleNewEntry = async () => {
    const {
      clientName, clientLastName, phoneNumber, email, address,
      bikeModel, bikeBrand, description, problem
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

    const dataCliente = registroModo === "existente"
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
      bikeModel, bikeBrand, description, problem,
      status: "lavado",
      entryDate: new Date().toISOString().slice(0,10),
      comments: {},
      invoiceNumber: "",
    };

    try {
      const added = await fetchJSON("/api/bikes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newBike),
      });
      const addedNorm = { ...added, comments: normalizeComments(added?.comments) };
      const newBikes = [addedNorm, ...bikes];
      setBikes(newBikes);
      setClients(deriveClientsFromBikes(newBikes));

      alert("Bicicleta registrada con éxito.");
      if (userRole === "admin") {
        setFacturaEntradaData(addedNorm);
        setMostrarFacturaEntrada(true);
      }

      setFormData(initialFormDataState);
      setRegistroModo(null);
      setSelectedClient(null);
    } catch (e) {
      console.error(e);
      alert("No se pudo registrar la bicicleta.");
    }
  };

  /* ============================ ABRIR / EDITAR ============================ */
  const handleEditClick = async (row) => {
    try {
      const fresh = await fetchJSON(`/api/bikes/${row.id}`);
      setEditingBike({ ...fresh, comments: normalizeComments(fresh?.comments) });
      setFormData({
        clientName: fresh.clientName || "",
        clientLastName: fresh.clientLastName || "",
        phoneNumber: fresh.phoneNumber || "",
        email: fresh.email || "",
        address: fresh.address || "",
        bikeModel: fresh.bikeModel || "",
        bikeBrand: fresh.bikeBrand || "",
        description: fresh.description || "",
        problem: fresh.problem || "",
        status: fresh.status || "",
        invoiceNumber: fresh.invoiceNumber || "",
      });
    } catch (e) {
      console.error(e);
      alert("No se pudo abrir la bici.");
    }
  };

  const handleEditInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSaveEdit = async () => {
    if (!editingBike) return;
    try {
      const payload = { ...editingBike, ...formData };
      const updated = await fetchJSON(`/api/bikes/${editingBike.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const updNorm = { ...updated, comments: normalizeComments(updated?.comments) };
      const nextBikes = bikes.map(b => (b.id === updNorm.id ? updNorm : b));
      setBikes(nextBikes);
      setClients(deriveClientsFromBikes(nextBikes));

      setEditingBike(null);
      alert("Bicicleta actualizada.");

      if (
        userRole === "admin" &&
        ["listo_tienda", "listo_chofer", "terminado", "chofer", "entregada"].includes(payload.status)
      ) {
        setFacturaSalidaData(updNorm);
        setMostrarFacturaSalida(true);
      }
    } catch (e) {
      console.error(e);
      alert("No se pudo actualizar la bicicleta.");
    }
  };

  const extractBikeId = (bikeOrId) => {
    const raw = (typeof bikeOrId === "object")
      ? (bikeOrId?.id ?? bikeOrId?.id_bike ?? bikeOrId?.bike_id)
      : bikeOrId;
    const n = Number(String(raw ?? "").trim());
    return Number.isFinite(n) ? n : null;
  };

  const handleDeleteBike = async (bikeOrId) => {
    const id = extractBikeId(bikeOrId);
    if (id === null) return alert("ID inválido");
    if (!window.confirm("¿Eliminar esta bicicleta?")) return;

    try {
      const res = await fetch(`${API}/api/bikes/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const msg = await res.text().catch(() => "");
        throw new Error(`${res.status} - ${msg}`);
      }
      setBikes((prev) => {
        const next = prev.filter(b => extractBikeId(b) !== id);
        setClients(deriveClientsFromBikes(next));
        return next;
      });
      setEditingBike(null);
      setStatusModal(null);
    } catch (e) {
      console.error("[DELETE bike] error", e);
      alert("No se pudo eliminar en el servidor.");
    }
  };

  /* ======================= Historial & Listas por estado ======================= */
  const handleClientHistory = (clientKeyOrId) => {
    const client = clients.find(c => c.id === clientKeyOrId);
    if (!client) return setClientHistory(null);
    const bikesOfClient = bikes.filter(b => clientKeyFromBike(b) === client.id);
    setClientHistory({ client, bikes: bikesOfClient });
  };

  const handleStatusClick = (status) => {
    const bikesInStatus = bikes.filter((b) => {
      const base = normalizeStatusKey(String(b.status || ""));
      const ns = STATUS_ALIASES[base] ? STATUS_ALIASES[base] : base;
      return ns === status;
    });
    setStatusModal({ status, bikes: bikesInStatus, search: "" });
  };

  /* ========================== Facturas rápidas ========================== */
  const openFacturaEntrada = (bike) => {
    setFacturaEntradaData(bike || null);
    setMostrarFacturaEntrada(true);
  };
  const openFacturaSalida = (bike) => {
    setFacturaSalidaData(bike || null);
    setMostrarFacturaSalida(true);
  };

  /* ============================ Comentarios ============================ */
  const openCommentsModal = (bike, initialTab = (bike && bike.status) || "admin") => {
    const base = normalizeStatusKey(initialTab);
    const normalizedInitial = STATUS_ALIASES[base] || base;
    const safeTab = COMMENT_KEYS.includes(normalizedInitial) ? normalizedInitial : "admin";
    setCommentsModal({
      bike: bike || { clientName: "", clientLastName: "", comments: {} },
      activeTab: safeTab,
      temp: normalizeComments(bike?.comments || {}),
    });
  };

  const closeCommentsModal = () => setCommentsModal(null);

  const saveComments = async () => {
    if (!commentsModal || !commentsModal.bike?.id) {
      setCommentsModal(null);
      return;
    }
    const { bike, temp } = commentsModal;
    try {
      const payload = { ...bike, comments: temp };
      const updated = await fetchJSON(`/api/bikes/${bike.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const updNorm = { ...updated, comments: normalizeComments(updated?.comments) };
      setBikes(prev => prev.map(b => (b.id === updNorm.id ? updNorm : b)));
      setCommentsModal(null);
      alert("Comentarios guardados.");
    } catch (e) {
      console.error(e);
      alert("No se pudieron guardar los comentarios.");
    }
  };

  /* ================================== UI ================================== */
  if (loading) return <div className="p-6 text-gray-700">Cargando…</div>;

  return (
    <div className="p-6 bg-white text-gray-900 min-h-screen">
      <h2 className="text-3xl font-bold mb-6">Panel de Administrador</h2>

      {/* =========================== REGISTRO =========================== */}
      <div className="mb-8 p-6 rounded-xl shadow-sm border border-gray-200 bg-white">
        <h3 className="text-2xl font-bold mb-4">Registrar Entrada</h3>

        {registroModo === null && (
          <div className="flex gap-4">
            <button
              onClick={() => { setRegistroModo("nuevo"); setFormData(initialFormDataState); }}
              className="bg-green-600 text-white px-5 py-2 rounded-lg font-semibold hover:bg-green-700"
              type="button"
            >
              Registrar Nuevo Cliente
            </button>
            <button
              onClick={() => setRegistroModo("existente")}
              className="bg-blue-600 text-white px-5 py-2 rounded-lg font-semibold hover:bg-blue-700"
              type="button"
            >
              Seleccionar Cliente Existente
            </button>
          </div>
        )}

        {registroModo && (
          <button
            onClick={() => { setRegistroModo(null); setSelectedClient(null); setFormData(initialFormDataState); }}
            className="mt-4 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 border border-gray-200"
            type="button"
          >
            ← Volver
          </button>
        )}

        {registroModo === "nuevo" && (
          <div className="mt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <input name="clientName" value={formData.clientName} onChange={handleNewEntryInputChange} className="w-full px-4 py-2 border rounded-lg bg-white border-gray-300" placeholder="Nombre del Cliente*" />
              <input name="clientLastName" value={formData.clientLastName} onChange={handleNewEntryInputChange} className="w-full px-4 py-2 border rounded-lg bg-white border-gray-300" placeholder="Apellido del Cliente*" />
              <input name="phoneNumber" value={formData.phoneNumber} onChange={handleNewEntryInputChange} className="w-full px-4 py-2 border rounded-lg bg-white border-gray-300" placeholder="Teléfono*" />
              <input name="email" value={formData.email} onChange={handleNewEntryInputChange} className="w-full px-4 py-2 border rounded-lg bg-white border-gray-300" placeholder="Correo" />
              <input name="address" value={formData.address} onChange={handleNewEntryInputChange} className="w-full px-4 py-2 border rounded-lg bg-white border-gray-300 col-span-2" placeholder="Dirección" />
              <input name="bikeBrand" value={formData.bikeBrand} onChange={handleNewEntryInputChange} className="w-full px-4 py-2 border rounded-lg bg-white border-gray-300" placeholder="Marca de Bicicleta*" />
              <input name="bikeModel" value={formData.bikeModel} onChange={handleNewEntryInputChange} className="w-full px-4 py-2 border rounded-lg bg-white border-gray-300" placeholder="Modelo de Bicicleta*" />
            </div>
            <textarea name="description" value={formData.description} onChange={handleNewEntryInputChange} className="w-full mb-4 px-4 py-2 border rounded-lg bg-white border-gray-300" placeholder="Descripción Adicional" />
            <textarea name="problem" value={formData.problem} onChange={handleNewEntryInputChange} className="w-full mb-4 px-4 py-2 border rounded-lg bg-white border-gray-300" placeholder="Problema/Motivo de Ingreso" />
            <button onClick={handleNewEntry} className="px-6 py-3 bg-green-600 text-white rounded-lg font-semibold" type="button">
              Registrar Bicicleta
            </button>
          </div>
        )}

        {registroModo === "existente" && !selectedClient && (
          <div className="rounded-xl mt-6">
            <h3 className="text-xl font-bold mb-4">Selecciona un Cliente</h3>
            <input
              type="text"
              placeholder="Buscar por nombre o teléfono…"
              className="mb-4 w-full max-w-md px-4 py-2 border rounded-lg bg-white border-gray-300"
              value={searchClientQuery}
              onChange={(e) => setSearchClientQuery(e.target.value)}
            />
            <ul className="space-y-2 max-h-80 overflow-y-auto">
              {filteredClients.map(client => (
                <li
                  key={client.id}
                  className="p-3 rounded-xl flex justify-between items-center cursor-pointer hover:bg-gray-50 bg-white border border-gray-200"
                  onClick={() => { setSelectedClient(client); setFormData(initialFormDataState); }}
                >
                  <div><strong>{client.name} {client.lastName}</strong> – {client.phone}</div>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleClientHistory(client.id); }}
                    className="bg-indigo-600 text-white px-3 py-1 text-sm rounded hover:bg-indigo-700"
                    type="button"
                  >Ver Historial</button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {registroModo === "existente" && selectedClient && (
          <div className="mt-4">
            <h3 className="text-xl font-bold mb-4">Registrar Bicicleta para {selectedClient.name} {selectedClient.lastName}</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              <input name="bikeBrand" value={formData.bikeBrand} onChange={handleNewEntryInputChange} className="w-full px-4 py-2 border rounded-lg bg-white border-gray-300" placeholder="Marca de Bicicleta*" />
              <input name="bikeModel" value={formData.bikeModel} onChange={handleNewEntryInputChange} className="w-full px-4 py-2 border rounded-lg bg-white border-gray-300" placeholder="Modelo de Bicicleta*" />
            </div>
            <textarea name="description" value={formData.description} onChange={handleNewEntryInputChange} className="w-full mb-4 px-4 py-2 border rounded-lg bg-white border-gray-300" placeholder="Descripción adicional" />
            <textarea name="problem" value={formData.problem} onChange={handleNewEntryInputChange} className="w-full mb-4 px-4 py-2 border rounded-lg bg-white border-gray-300" placeholder="Problema" />
            <button onClick={handleNewEntry} className="px-6 py-3 bg-green-600 text-white rounded-lg font-semibold" type="button">
              Registrar Bicicleta
            </button>
          </div>
        )}
      </div>

      {/* ======================= CONTADORES POR ESTADO ======================= */}
      <div className="mb-8">
        <h3 className="text-2xl font-bold mb-4">Contadores por Estado</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          {ALL_STATUSES.map((status) => (
            <div
              key={status}
              className="p-4 rounded-xl shadow-sm text-center cursor-pointer transition bg-white border border-gray-200 hover:bg-gray-50"
              onClick={() => handleStatusClick(status)}
            >
              <p className="text-gray-600 text-sm font-medium">
                {getStatusDisplayName(status) || status}
              </p>
              <p className="text-3xl font-bold text-gray-900">{statusCounts[status] || 0}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ============================ BUSCADOR ============================ */}
      <div className="mb-6">
        <input
          type="text"
          placeholder="Buscar bicicleta por cliente, marca, modelo o ID…"
          value={searchBike}
          onChange={(e) => setSearchBike(e.target.value)}
          className="mb-4 px-4 py-2 border rounded-lg w-full max-w-md bg-white border-gray-300"
        />
      </div>

      {/* ============================= LISTADO ============================= */}
      <h3 className="text-2xl font-bold mb-6">Bicicletas</h3>
      {filteredBikes.length === 0 ? (
        <p>No hay bicicletas registradas.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredBikes.map(bike => (
            <div key={bike.id} className="p-6 rounded-2xl shadow-sm border flex flex-col justify-between bg-white border-gray-200">
              <div>
                <div className="flex justify-between items-start">
                  <div className="inline-block px-3 py-1 mb-3 rounded-full bg-gray-100 text-sm font-semibold text-gray-700">
                    {getStatusDisplayName(bike.status) || bike.status}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleClientHistory(clientKeyFromBike(bike))}
                      className="text-sm text-indigo-600 font-semibold hover:underline"
                      type="button"
                    >
                      Historial
                    </button>
                    <button
                      onClick={() => openCommentsModal(bike)}
                      className="text-sm text-teal-600 font-semibold hover:underline"
                      title="Comentarios por estado"
                      type="button"
                    >
                      Comentarios
                    </button>
                  </div>
                </div>

                <h3 className="text-xl font-semibold text-gray-900">
                  {bike.clientName} {bike.clientLastName}
                </h3>
                <p className="text-sm text-gray-600">
                  Modelo: {bike.bikeModel} / Marca: {bike.bikeBrand}
                </p>
                {bike.description && (
                  <p className="text-sm mb-2 text-gray-700">Problema: {bike.description}</p>
                )}
                {bike.problem && (
                  <p className="text-sm font-medium text-gray-900">Diagnóstico: {bike.problem}</p>
                )}
                {bike.invoiceNumber && (
                  <p className="text-xs font-medium text-gray-700">Fact #: {bike.invoiceNumber}</p>
                )}
                {bike.entryDate && (
                  <p className="text-xs text-gray-500">Entrada: {String(bike.entryDate).slice(0,10)}</p>
                )}
              </div>

              <div className="flex flex-wrap gap-2 mt-4">
                <button
                  onClick={() => handleEditClick(bike)}
                  className="flex-1 bg-gray-900 text-white py-2 rounded-xl hover:bg-black"
                  type="button"
                >
                  Editar
                </button>
                <button
                  onClick={() => handleDeleteBike(bike.id)}
                  className="flex-1 bg-red-600 text-white py-2 rounded-xl hover:bg-red-700"
                  type="button"
                >
                  Eliminar
                </button>

                {/* PDF ENTRADA */}
                <button
                  onClick={() => openFacturaEntrada(bike)}
                  className="w-full bg-blue-600 text-white py-2 rounded-xl hover:bg-blue-700"
                  title="Factura de Entrada (Descargar/Imprimir)"
                  type="button"
                >
                  Factura Entrada (PDF)
                </button>

                {/* PDF SALIDA */}
                <button
                  onClick={() => openFacturaSalida(bike)}
                  className="w-full bg-gray-800 text-white py-2 rounded-xl hover:bg-gray-900 disabled:opacity-40"
                  disabled={!["listo_tienda","listo_chofer","terminado","chofer","entregada"].includes(bike.status)}
                  title="Factura de Salida (Descargar/Imprimir)"
                  type="button"
                >
                  Factura Salida (PDF)
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ======================= MODAL: HISTORIAL CLIENTE ======================= */}
      {clientHistory && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-gray-200 max-w-2xl w-full p-6 rounded-xl shadow-xl overflow-y-auto max-h-[80vh] text-gray-900">
            <h3 className="text-xl font-bold mb-4">
              Historial de {clientHistory.client.name} {clientHistory.client.lastName}
            </h3>
            {clientHistory.bikes.length === 0 ? (
              <p className="text-gray-600">Este cliente no tiene bicicletas registradas.</p>
            ) : (
              <ul className="space-y-3">
                {clientHistory.bikes.map(bike => (
                  <li key={bike.id} className="bg-white border border-gray-200 p-4 rounded-xl">
                    <p><strong>Marca:</strong> {bike.bikeBrand} | <strong>Modelo:</strong> {bike.bikeModel}</p>
                    <p><strong>Estado:</strong> {getStatusDisplayName(bike.status) || bike.status}</p>
                    <p className="text-xs text-gray-500">Fecha de entrada: {String(bike.entryDate).slice(0,10)}</p>
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-4 flex justify-end">
              <button onClick={() => setClientHistory(null)} className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 border border-gray-200" type="button">Cerrar</button>
            </div>
          </div>
        </div>
      )}

      {/* ========================= MODAL: LISTA POR ESTADO ========================= */}
      {statusModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-gray-200 max-w-2xl w-full p-6 rounded-xl shadow-xl overflow-y-auto max-h-[90vh] relative text-gray-900">
            <button onClick={() => setStatusModal(null)} className="absolute top-4 right-4 bg-red-600 text-white px-4 py-1 rounded-lg hover:bg-red-700" type="button">Cerrar</button>
            <h3 className="text-xl font-bold mb-2">
              Bicicletas en estado: {getStatusDisplayName(statusModal.status) || statusModal.status}
            </h3>
            <input
              type="text"
              placeholder="Buscar por cliente, marca o modelo..."
              className="mb-4 w-full px-4 py-2 border rounded-lg bg-white border-gray-300"
              value={statusModal.search || ""}
              onChange={(e) => setStatusModal({ ...statusModal, search: e.target.value })}
            />
            {statusModal.bikes.filter(b =>
              `${b.clientName} ${b.clientLastName} ${b.bikeBrand} ${b.bikeModel}`
                .toLowerCase()
                .includes((statusModal.search || "").toLowerCase())
            ).length === 0 ? (
              <p className="text-gray-600">No hay bicicletas que coincidan.</p>
            ) : (
              <ul className="space-y-3">
                {statusModal.bikes
                  .filter(b =>
                    `${b.clientName} ${b.clientLastName} ${b.bikeBrand} ${b.bikeModel}`
                      .toLowerCase()
                      .includes((statusModal.search || "").toLowerCase())
                  )
                  .map(bike => (
                    <li key={bike.id} className="bg-white border border-gray-200 p-4 rounded-xl">
                      <p><strong>Cliente:</strong> {bike.clientName} {bike.clientLastName}</p>
                      <p><strong>Marca:</strong> {bike.bikeBrand} | <strong>Modelo:</strong> {bike.bikeModel}</p>
                      <p><strong>Diagnóstico:</strong> {bike.problem || "No especificado"}</p>
                      <p className="text-xs text-gray-500">Fecha de entrada: {String(bike.entryDate).slice(0,10)}</p>
                    </li>
                  ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {/* ======================= MODAL: COMENTARIOS ======================= */}
      {commentsModal && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={(e) => { if (e.target === e.currentTarget) closeCommentsModal(); }}
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white border border-gray-200 w-full max-w-2xl rounded-2xl p-6 relative shadow-xl text-gray-900">
            <button
              type="button"
              onClick={closeCommentsModal}
              className="absolute top-3 right-3 bg-red-600 text-white px-3 py-1 rounded hover:bg-red-700"
              aria-label="Cerrar"
            >
              ×
            </button>

            <h3 className="text-2xl font-bold mb-4">
              Comentarios — {commentsModal.bike?.clientName} {commentsModal.bike?.clientLastName}
            </h3>

            <div className="flex flex-wrap gap-2 mb-4">
              {COMMENT_KEYS.map((k) => {
                const isActive = commentsModal.activeTab === k;
                return (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setCommentsModal((m) => ({ ...m, activeTab: k }))}
                    className={`px-3 py-1 rounded-full border text-sm transition
                      ${isActive
                        ? "bg-gray-900 text-white border-gray-900"
                        : "bg-white text-gray-800 border-gray-300 hover:bg-gray-50"}`}
               >
                    {getStatusDisplayName(k) || k}
                  </button>
                );
              })}
            </div>

            <div className="mb-4">
              <textarea
                className="w-full border rounded-xl p-3 h-[140px] bg-white border-gray-300"
                placeholder={`Escribe comentarios para "${getStatusDisplayName(commentsModal.activeTab) || commentsModal.activeTab}"…`}
                value={commentsModal.temp?.[commentsModal.activeTab] || ""}
                onChange={(e) =>
                  setCommentsModal((m) => ({
                    ...m,
                    temp: { ...(m.temp || {}), [m.activeTab]: e.target.value },
                  }))
                }
              />
              <p className="text-xs text-gray-500 mt-1">
                Se guarda en <code>{`comments["${commentsModal.activeTab}"]`}</code>.
              </p>
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={closeCommentsModal}
                className="px-5 py-2 rounded-xl bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-200"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={saveComments}
                className="px-5 py-2 rounded-xl bg-gray-900 text-white border border-gray-800 hover:opacity-90"
              >
                Guardar Comentarios
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =================== MODAL: FACTURA ENTRADA =================== */}
      {mostrarFacturaEntrada && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
          <div className="bg-white border border-gray-200 p-6 rounded-xl w-full max-w-md relative text-gray-900">
            <button
              onClick={() => { setMostrarFacturaEntrada(false); setFacturaEntradaData(null); }}
              className="absolute top-2 right-2 bg-red-600 text-white px-2 py-1 rounded"
              type="button"
            >
              ✕
            </button>

            <div ref={entradaRef} className="print-area">
              {facturaEntradaData ? (
                <FacturaEntrada bike={facturaEntradaData} />
              ) : (
                <div className="p-4 border rounded-lg text-sm text-gray-700 bg-white border-gray-300">
                  <p><strong>Vista previa Factura de Entrada</strong></p>
                  <p>No hay datos de bicicleta.</p>
                </div>
              )}
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <button
                onClick={async () => {
                  if (!entradaRef.current) return;
                  try {
                    await downloadPdfFromRef(
                      entradaRef.current,
                      `entrada_${facturaEntradaData?.id || "sin_datos"}.pdf`
                    );
                  } catch {
                    printEntrada?.();
                  }
                }}
                className="w-full bg-blue-600 text-white py-2 rounded-lg"
                type="button"
              >
                Descargar PDF
              </button>
              <button onClick={() => printEntrada?.()} className="w-full bg-gray-800 text-white py-2 rounded-lg" type="button">
                Imprimir / Guardar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =================== MODAL: FACTURA SALIDA =================== */}
      {mostrarFacturaSalida && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
          <div className="bg-white border border-gray-200 p-6 rounded-xl w-full max-w-md relative text-gray-900">
            <button
              onClick={() => { setMostrarFacturaSalida(false); setFacturaSalidaData(null); }}
              className="absolute top-2 right-2 bg-red-600 text-white px-2 py-1 rounded"
              type="button"
            >
              ✕
            </button>

            <div ref={salidaRef} className="print-area">
              {facturaSalidaData ? (
                <Factura bike={facturaSalidaData} />
              ) : (
                <div className="p-4 border rounded-lg text-sm text-gray-700 bg-white border-gray-300">
                  <p><strong>Vista previa Factura de Salida</strong></p>
                  <p>No hay datos de bicicleta.</p>
                </div>
              )}
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <button
                onClick={async () => {
                  if (!salidaRef.current) return;
                  try {
                    await downloadPdfFromRef(
                      salidaRef.current,
                      `salida_${facturaSalidaData?.id || "sin_datos"}.pdf`
                    );
                  } catch {
                    printSalida?.();
                  }
                }}
                className="w-full bg-blue-600 text-white py-2 rounded-lg"
                type="button"
              >
                Descargar PDF
              </button>
              <button onClick={() => printSalida?.()} className="w-full bg-gray-800 text-white py-2 rounded-lg" type="button">
                Imprimir / Guardar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
