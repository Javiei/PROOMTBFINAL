// src/components/Mecanico.js
import React, { useEffect, useMemo, useState } from "react";
import { getStatusDisplayName } from "../utils/helpers";

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
  return res.json();
}

/* ========= Normalización de estados y comentarios ========= */
const normalizeStatusKey = (k = "") =>
  k
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

const STATUS_ALIASES = {
  "en cotización": "en cotizacion",
  "en reparación": "en reparacion",
  "por cotización": "por cotizar",
};

function normalizeComments(cmt) {
  if (!cmt) return {};
  if (typeof cmt === "string") {
    try {
      cmt = JSON.parse(cmt);
    } catch {
      return {};
    }
  }
  if (typeof cmt !== "object") return {};
  const out = {};
  for (const k of Object.keys(cmt)) {
    const nk = STATUS_ALIASES[k] ? STATUS_ALIASES[k] : normalizeStatusKey(k);
    out[nk] = cmt[k];
  }
  return out;
}

/* ========= Estados visibles/gestionables por el mecánico ========= */
const ALLOWED_STATUSES = ["en reparacion", "por cotizar", "en cotizacion"];
const ALLOWED_SET = new Set(ALLOWED_STATUSES.map(normalizeStatusKey));

/* ========= Detección de asignación al mecánico ========= */
const norm = (s) => (s ?? "").toString().trim().toLowerCase();
function isAssignedToMe(bike, me) {
  if (!bike || !me) return false;
  const meU = norm(me.username || me.user || me.name || me.email);
  const meId = String(me.id ?? "").trim();

  const candidates = [
    bike.assignedTo,
    bike.assignedUser,
    bike.assignedMechanic,
    bike.mechanicUsername,
    bike.mechanicUser,
    bike.mecanico,
    bike.mechanic,
    bike.assignee,
    bike.userAssigned,
    bike.asignadoA,
  ];

  for (const c of candidates) {
    if (!c) continue;
    if (typeof c === "object") {
      const cu = norm(c.username || c.user || c.name || c.email);
      const cid = String(c.id ?? "").trim();
      if ((cu && cu === meU) || (cid && cid === meId)) return true;
    } else {
      const cu = norm(c);
      if (cu && (cu === meU || cu === meId)) return true;
    }
  }

  if (bike.assigned && typeof bike.assigned === "object") {
    const cu = norm(bike.assigned.username || bike.assigned.email || bike.assigned.name);
    const cid = String(bike.assigned.id ?? "").trim();
    if ((cu && cu === meU) || (cid && cid === meId)) return true;
  }

  return false;
}

/* =============================== COMPONENTE =============================== */
export default function Mecanico() {
  const [bikes, setBikes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [me, setMe] = useState(null);

  // UI
  const [quickFilter, setQuickFilter] = useState(""); // "", o uno de ALLOWED
  const [search, setSearch] = useState(""); // barra de búsqueda
  const [commentsModal, setCommentsModal] = useState(null); // { bike, activeTab, temp }
  const [activeBikeModal, setActiveBikeModal] = useState(null); // { bike }

  // Edición en tarjeta/modal
  const [editing, setEditing] = useState({}); // { [id]: { problem: string, note: string } }

  /* ===================== Carga ===================== */
  const load = async () => {
    try {
      // 1) Usuario actual
      let user = null;
      try {
        user = await fetchJSON("/api/auth/me");
      } catch {}
      setMe(user);

      // 2) Intentar endpoint específico del mecánico
      let list = null;
      try {
        list = await fetchJSON("/api/bikes/mecanico?mine=1");
      } catch {
        list = await fetchJSON("/api/bikes");
      }

      const arr = Array.isArray(list) ? list : [];
      const normed = arr.map((x) => ({ ...x, comments: normalizeComments(x?.comments) }));

      // 3) Filtrar a mis bicis
      const onlyMine = user ? normed.filter((b) => isAssignedToMe(b, user)) : normed;

      // 4) Filtrar por estados permitidos del mecánico
      const onlyAllowed = onlyMine.filter((b) => ALLOWED_SET.has(normalizeStatusKey(b?.status)));

      setBikes(onlyAllowed);
    } catch (e) {
      console.error(e);
      alert("No se pudieron cargar bicicletas.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  /* ====================== CONTADORES (solo 3 estados) ====================== */
  const statusCounts = useMemo(() => {
    const acc = { en_reparacion: 0, por_cotizar: 0, en_cotizacion: 0 };
    for (const b of bikes) {
      const s = normalizeStatusKey(b?.status);
      if (s === "en reparacion") acc.en_reparacion++;
      else if (s === "por cotizar") acc.por_cotizar++;
      else if (s === "en cotizacion") acc.en_cotizacion++;
    }
    return acc;
  }, [bikes]);

  const orderedStatusForCounters = useMemo(
    () => ALLOWED_STATUSES.filter((s) => {
      const m = {
        "en reparacion": statusCounts.en_reparacion,
        "por cotizar": statusCounts.por_cotizar,
        "en cotizacion": statusCounts.en_cotizacion,
      };
      return (m[s] ?? 0) > 0; // Ocultar los que están en 0
    }),
    [statusCounts]
  );

  /* ====================== LISTA (mis bicis + filtros) ====================== */
  const visibleBikes = useMemo(() => {
    let data = bikes;

    if (quickFilter) {
      const k = normalizeStatusKey(quickFilter);
      data = data.filter((b) => normalizeStatusKey(b?.status || "") === k);
    }

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      data = data.filter((b) => {
        const fields = [
          b.clientName,
          b.clientLastName,
          b.phoneNumber,
          b.email,
          b.bikeBrand,
          b.bikeModel,
          b.serialNumber,
          b.description,
          b.problem,
        ]
          .filter(Boolean)
          .map((x) => String(x).toLowerCase());
        return fields.some((f) => f.includes(q));
      });
    }

    return data;
  }, [bikes, quickFilter, search]);

  /* ====================== Helpers de edición local ====================== */
  const getEd = (id) => editing[id] || { problem: "", note: "" };

  const setEdField = (id, field, value) =>
    setEditing((p) => ({ ...p, [id]: { ...(p[id] || { problem: "", note: "" }), [field]: value } }));

  /* ====================== PUT genérico ====================== */
  const updateBike = async (bikeId, patch) => {
    try {
      const fresh = await fetchJSON(`/api/bikes/${bikeId}`);
      const payload = { ...fresh, ...patch };
      const updated = await fetchJSON(`/api/bikes/${bikeId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const updNorm = { ...updated, comments: normalizeComments(updated?.comments) };
      setBikes((prev) => prev.map((x) => (x.id === updNorm.id ? updNorm : x)));
      return updNorm;
    } catch (e) {
      console.error(e);
      alert("No se pudo actualizar la bicicleta.");
    }
  };

  /* ====================== Acciones del Mecánico ====================== */
  const saveDiagnostico = (bike) => {
    const value = (getEd(bike.id).problem || "").trim();
    return updateBike(bike.id, { problem: value });
  };

  const saveNotaMecanico = (bike) => {
    const note = (getEd(bike.id).note || "").trim();
    if (!note) return;
    const current = bike.comments?.mecanico || "";
    const merged = current ? `${current}\n${note}` : note;
    return updateBike(bike.id, { comments: { ...(bike.comments || {}), mecanico: merged } }).then(
      () => setEditing((p) => ({ ...p, [bike.id]: { ...(p[bike.id] || {}), note: "" } }))
    );
  };

  const toPorCotizar = (bike) => updateBike(bike.id, { status: "por cotizar" });
  const toEnCotizacion = (bike) => updateBike(bike.id, { status: "en cotizacion" });
  const toEnReparacion = (bike) => updateBike(bike.id, { status: "en reparacion" });

  /* ====================== Comentarios por estado (modal clásico) ====================== */
  const COMMENT_KEYS = ["mecanico", ...ALLOWED_STATUSES]; // tabs relevantes para el mecánico

  const openCommentsModal = (bike, initialTab = (bike && bike.status) || "mecanico") => {
    const normalizedInitial = STATUS_ALIASES[initialTab] || normalizeStatusKey(initialTab);
    const safeTab = COMMENT_KEYS.includes(normalizedInitial) ? normalizedInitial : "mecanico";
    setCommentsModal({ bike, activeTab: safeTab, temp: normalizeComments(bike?.comments || {}) });
  };

  const saveComments = async () => {
    if (!commentsModal || !commentsModal?.bike?.id) {
      setCommentsModal(null);
      return;
    }
    const { bike, temp } = commentsModal;
    try {
      const fresh = await fetchJSON(`/api/bikes/${bike.id}`);
      const payload = { ...fresh, comments: temp };
      const updated = await fetchJSON(`/api/bikes/${bike.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const updNorm = { ...updated, comments: normalizeComments(updated?.comments) };
      setBikes((prev) => prev.map((x) => (x.id === updNorm.id ? updNorm : x)));
      setCommentsModal(null);
      alert("Comentarios guardados.");
    } catch (e) {
      console.error(e);
      alert("No se pudieron guardar los comentarios.");
    }
  };

  /* ====================== Modal Interactivo de Bicicleta ====================== */
  function BikeActionsModal({ bike, onClose }) {
    const ed = getEd(bike.id);

    const confirmAnd = async (msg, fn) => {
      if (window.confirm(msg)) {
        await fn(bike);
      }
    };

    return (
      <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
        <div className="bg-white border border-gray-200 w-full max-w-3xl rounded-2xl p-6 relative shadow-xl text-gray-900">
          <button
            onClick={onClose}
            className="absolute top-3 right-3 bg-red-600 text-white px-3 py-1 rounded"
            type="button"
          >
            ✕
          </button>

          <h3 className="text-2xl font-bold mb-1">{bike.clientName} {bike.clientLastName}</h3>
          <p className="text-sm text-gray-600 mb-4">
            {getStatusDisplayName(bike.status) || bike.status} • {bike.bikeBrand} {bike.bikeModel}
          </p>

          {/* Tabs simples */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Ficha */}
            <div className="border border-gray-200 rounded-xl p-4">
              <h4 className="font-semibold mb-2">Ficha</h4>
              <div className="text-sm text-gray-700 space-y-1">
                {bike.serialNumber && (
                  <p><span className="text-gray-500">Serie:</span> {bike.serialNumber}</p>
                )}
                {bike.phoneNumber && (
                  <p><span className="text-gray-500">Tel:</span> {bike.phoneNumber}</p>
                )}
                {bike.email && (
                  <p><span className="text-gray-500">Email:</span> {bike.email}</p>
                )}
                {bike.entryDate && (
                  <p><span className="text-gray-500">Entrada:</span> {String(bike.entryDate).slice(0,10)}</p>
                )}
                {bike.description && (
                  <p className="mt-2"><span className="text-gray-500">Problema reportado:</span> {bike.description}</p>
                )}
                {bike.problem && (
                  <p className=""><span className="text-gray-500">Diagnóstico actual:</span> {bike.problem}</p>
                )}
              </div>
            </div>

            {/* Diagnóstico / Nota */}
            <div className="border border-gray-200 rounded-xl p-4 space-y-3">
              <h4 className="font-semibold">Diagnóstico y Nota</h4>
              <textarea
                placeholder="Actualizar diagnóstico (campo 'problem')…"
                value={ed.problem}
                onChange={(e) => setEdField(bike.id, "problem", e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-white border border-gray-300 text-gray-900"
              />
              <button
                type="button"
                onClick={() => saveDiagnostico(bike)}
                className="px-4 py-2 rounded-lg bg-gray-900 text-white"
              >
                Guardar Diagnóstico
              </button>
              <textarea
                placeholder="Nota / Presupuesto para 'mecánico' (comments.mecanico)…"
                value={ed.note}
                onChange={(e) => setEdField(bike.id, "note", e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-white border border-gray-300 text-gray-900"
              />
              <button
                type="button"
                onClick={() => saveNotaMecanico(bike)}
                className="px-4 py-2 rounded-lg bg-gray-100 border border-gray-300 hover:bg-gray-200"
              >
                Guardar Nota Mecánico
              </button>
            </div>
          </div>

          {/* Cambiar estado + Comentarios */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
            <div className="border border-gray-200 rounded-xl p-4">
              <h4 className="font-semibold mb-3">Cambiar estado</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => confirmAnd("¿Mover a Por Cotizar?", toPorCotizar)}
                  className="px-3 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white"
                >
                  → Por Cotizar
                </button>
                <button
                  type="button"
                  onClick={() => confirmAnd("¿Mover a En Cotización?", toEnCotizacion)}
                  className="px-3 py-2 rounded-lg bg-amber-700 hover:bg-amber-800 text-white"
                >
                  → En Cotización
                </button>
                <button
                  type="button"
                  onClick={() => confirmAnd("¿Mover a En Reparación?", toEnReparacion)}
                  className="px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white"
                >
                  → Reparación
                </button>
              </div>
            </div>

            <div className="lg:col-span-2 border border-gray-200 rounded-xl p-4">
              <div className="flex items-center justify-between">
                <h4 className="font-semibold">Comentarios por estado</h4>
                <button
                  type="button"
                  onClick={() => openCommentsModal(bike)}
                  className="px-3 py-1 rounded-lg bg-white border border-gray-300 hover:bg-gray-100"
                >
                  Abrir modal de comentarios
                </button>
              </div>
              <div className="text-sm text-gray-700 mt-3 max-h-48 overflow-auto space-y-2">
                {Object.keys(bike.comments || {}).length === 0 ? (
                  <p className="text-gray-500 italic">Sin comentarios.</p>
                ) : (
                  Object.entries(bike.comments).map(([k, v]) => (
                    <div key={k}>
                      <p className="text-gray-600 font-semibold">{getStatusDisplayName(k) || k}</p>
                      <pre className="whitespace-pre-wrap">{v}</pre>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          <div className="flex justify-end mt-6">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 border border-gray-300">Cerrar</button>
          </div>
        </div>
      </div>
    );
  }

  /* ====================== UI ====================== */
  if (loading) {
    return <div className="p-6 text-gray-600">Cargando…</div>; // modo claro
  }

  return (
    <div className="p-6 bg-white text-gray-900 min-h-screen">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between mb-6">
        <h2 className="text-3xl font-bold">Panel – Mecánico</h2>

        {/* Filtros */}
        <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600">Estado:</label>
            <select
              value={quickFilter}
              onChange={(e) => setQuickFilter(e.target.value)}
              className="px-3 py-2 rounded-lg bg-white text-gray-900 border border-gray-300"
            >
              <option value="">Todos</option>
              {ALLOWED_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {getStatusDisplayName(s) || s}
                </option>
              ))}
            </select>
          </div>

          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar (cliente, tel, marca, modelo, serie, diagnóstico)…"
            className="px-3 py-2 rounded-lg bg-white border border-gray-300 text-gray-900 w-full sm:w-80"
          />
        </div>
      </div>

      {/* Contadores (ocultando 0) */}
      <div className="mb-8">
        <h3 className="text-2xl font-bold mb-4">Contadores</h3>
        {orderedStatusForCounters.length === 0 ? (
          <p className="text-gray-600">Sin elementos en cola.</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {orderedStatusForCounters.map((status) => {
              const count =
                status === "en reparacion"
                  ? statusCounts.en_reparacion
                  : status === "por cotizar"
                  ? statusCounts.por_cotizar
                  : statusCounts.en_cotizacion;
              return (
                <button
                  key={status}
                  type="button"
                  onClick={() => setQuickFilter(status)}
                  className="p-4 rounded-xl shadow-sm text-center transition bg-white border border-gray-200 hover:border-gray-300 hover:shadow"
                  title={`Ver ${getStatusDisplayName(status) || status}`}
                >
                  <p className="text-gray-600 text-sm font-medium">{getStatusDisplayName(status) || status}</p>
                  <p className="text-3xl font-bold text-gray-900">{count}</p>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Lista de bicicletas */}
      <h3 className="text-2xl font-bold mb-6">Mis bicicletas</h3>
      {visibleBikes.length === 0 ? (
        <p className="text-gray-600">No hay bicicletas asignadas en estos estados.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {visibleBikes.map((bike) => {
            const ed = getEd(bike.id);
            return (
              <div
                key={bike.id}
                className="p-6 rounded-2xl shadow-md border bg-white border-gray-200 flex flex-col gap-4"
              >
                <div className="flex justify-between items-start">
                  <div className="inline-block px-3 py-1 rounded-full bg-gray-100 text-sm font-semibold text-gray-800 border border-gray-200">
                    {getStatusDisplayName(bike.status) || bike.status}
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => openCommentsModal(bike)}
                      className="text-sm text-teal-700 font-semibold hover:underline"
                      title="Comentarios por estado"
                    >
                      Comentarios
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveBikeModal({ bike })}
                      className="text-sm text-indigo-700 font-semibold hover:underline"
                      title="Abrir modal interactivo"
                    >
                      Abrir
                    </button>
                  </div>
                </div>

                <div>
                  <h4 className="text-xl font-semibold">
                    {bike.clientName} {bike.clientLastName}
                  </h4>
                  <p className="text-sm text-gray-600">
                    Modelo: {bike.bikeModel} / Marca: {bike.bikeBrand}
                  </p>
                  {bike.description && (
                    <p className="text-sm text-gray-700">Problema: {bike.description}</p>
                  )}
                  {bike.problem && (
                    <p className="text-sm text-gray-900 font-medium">Diagnóstico: {bike.problem}</p>
                  )}
                  {bike.entryDate && (
                    <p className="text-xs text-gray-500">Entrada: {String(bike.entryDate).slice(0, 10)}</p>
                  )}
                </div>

                {/* Diagnóstico / Nota rápidas */}
                <div className="space-y-3">
                  <textarea
                    placeholder="Actualizar diagnóstico (se guarda en 'problem')…"
                    value={ed.problem}
                    onChange={(e) => setEdField(bike.id, "problem", e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-white border border-gray-300 text-gray-900"
                  />
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => saveDiagnostico(bike)}
                      className="px-4 py-2 rounded-lg bg-gray-100 border border-gray-300 hover:bg-gray-200"
                    >
                      Guardar Diagnóstico
                    </button>
                  </div>

                  <textarea
                    placeholder="Nota / Presupuesto para 'mecánico' (comments.mecanico)…"
                    value={ed.note}
                    onChange={(e) => setEdField(bike.id, "note", e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-white border border-gray-300 text-gray-900"
                  />
                  <button
                    type="button"
                    onClick={() => saveNotaMecanico(bike)}
                    className="px-4 py-2 rounded-lg bg-gray-100 border border-gray-300 hover:bg-gray-200"
                  >
                    Guardar Nota Mecánico
                  </button>
                </div>

                {/* Acciones de estado (solo 3) */}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => toPorCotizar(bike)}
                    className="px-3 py-2 rounded-lg bg-amber-500/90 hover:bg-amber-600 text-white"
                    title="Enviar a 'Por Cotizar'"
                  >
                    → Por Cotizar
                  </button>
                  <button
                    type="button"
                    onClick={() => toEnCotizacion(bike)}
                    className="px-3 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white"
                    title="Enviar a 'En Cotización'"
                  >
                    → En Cotización
                  </button>
                  <button
                    type="button"
                    onClick={() => toEnReparacion(bike)}
                    className="px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white col-span-2"
                    title="Enviar a 'En Reparación'"
                  >
                    → Reparación
                  </button>
                </div>

                {/* Vista de comentarios (read-only) resumida */}
                <div className="mt-2">
                  <details className="bg-white rounded-lg border border-gray-200">
                    <summary className="cursor-pointer px-3 py-2 text-sm text-gray-700">Ver comentarios (resumen)</summary>
                    <div className="px-3 py-2 text-sm text-gray-700 space-y-2 max-h-44 overflow-auto">
                      {Object.keys(bike.comments || {}).length === 0 ? (
                        <p className="text-gray-500 italic">Sin comentarios.</p>
                      ) : (
                        Object.entries(bike.comments).map(([k, v]) => (
                          <div key={k}>
                            <p className="text-gray-600 font-semibold">{getStatusDisplayName(k) || k}</p>
                            <pre className="whitespace-pre-wrap">{v}</pre>
                          </div>
                        ))
                      )}
                    </div>
                  </details>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ======================= MODAL: COMENTARIOS POR ESTADO ======================= */}
      {commentsModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-gray-200 w-full max-w-2xl rounded-2xl p-6 relative shadow-xl text-gray-900">
            <button
              onClick={() => setCommentsModal(null)}
              className="absolute top-3 right-3 bg-red-600 text-white px-3 py-1 rounded"
              type="button"
            >
              ✕
            </button>

            <h3 className="text-2xl font-bold mb-4">
              Comentarios — {commentsModal.bike.clientName} {commentsModal.bike.clientLastName}
            </h3>

            <div className="flex flex-wrap gap-2 mb-4">
              {COMMENT_KEYS.map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setCommentsModal((m) => ({ ...m, activeTab: k }))}
                  className={`px-3 py-1 rounded-full border text-sm ${
                    commentsModal.activeTab === k
                      ? "bg-gray-900 text-white border-gray-800"
                      : "bg-white hover:bg-gray-50 border-gray-300 text-gray-800"
                  }`}
                >
                  {getStatusDisplayName(k) || k}
                </button>
              ))}
            </div>

            <div className="mb-4">
              <textarea
                className="w-full border rounded-xl p-3 min-h-[140px] bg-white border-gray-300 text-gray-900"
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
                Se guarda en <code>comments["{commentsModal.activeTab}"]</code>.
              </p>
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setCommentsModal(null)}
                className="px-4 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 border border-gray-300"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={saveComments}
                className="px-5 py-2 rounded-xl bg-gray-900 text-white"
              >
                Guardar Comentarios
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================= MODAL: ACCIONES INTERACTIVAS ======================= */}
      {activeBikeModal && (
        <BikeActionsModal bike={activeBikeModal.bike} onClose={() => setActiveBikeModal(null)} />
      )}
    </div>
  );
}
