// src/components/Chofer.js
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

/* ========= Normalización ========= */
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
    try { cmt = JSON.parse(cmt); } catch { return {}; }
  }
  if (typeof cmt !== "object") return {};
  const out = {};
  for (const k of Object.keys(cmt)) {
    const nk = STATUS_ALIASES[k] ? STATUS_ALIASES[k] : normalizeStatusKey(k);
    out[nk] = cmt[k];
  }
  return out;
}

/* ========= Pestañas de comentarios visibles al chofer ========= */
const COMMENT_KEYS = ["chofer", "listo_chofer"];

/* ========= Estados permitidos para Chofer (solo ver/gestionar) ========= */
const ALLOWED_STATUSES_CHOFER = ["listo_chofer", "chofer"];
const ALLOWED_SET = new Set(ALLOWED_STATUSES_CHOFER.map(normalizeStatusKey));

/* ========= Detección de asignación al chofer ========= */
const norm = (s) => (s ?? "").toString().trim().toLowerCase();
function isAssignedToMe(bike, me) {
  if (!bike || !me) return false;
  const meU = norm(me.username || me.user || me.name || me.email);
  const meId = String(me.id ?? "").trim();

  const candidates = [
    bike.assignedTo,
    bike.assignedDriver,
    bike.driverUsername,
    bike.choferUsuario,
    bike.chofer,
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
export default function Chofer() {
  const [bikes, setBikes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [me, setMe] = useState(null);

  // UI
  const [quickFilter, setQuickFilter] = useState(""); // "", o uno de ALLOWED
  const [search, setSearch] = useState(""); // barra de búsqueda
  const [commentsModal, setCommentsModal] = useState(null); // { bike, activeTab, temp }
  const [activeBikeModal, setActiveBikeModal] = useState(null); // { bike }
  const [editingNote, setEditingNote] = useState({}); // comments.chofer

  /* ===================== Carga ===================== */
  const load = async () => {
    try {
      // usuario
      let user = null;
      try { user = await fetchJSON("/api/auth/me"); } catch {}
      setMe(user);

      // lista optimizada por chofer
      let list = null;
      try {
        list = await fetchJSON("/api/bikes/chofer?mine=1");
      } catch {
        list = await fetchJSON("/api/bikes");
      }

      const arr = Array.isArray(list) ? list : [];
      const normed = arr.map((x) => ({ ...x, comments: normalizeComments(x?.comments) }));

      // solo mis bicis (si hay usuario)
      const onlyMine = user ? normed.filter((b) => isAssignedToMe(b, user)) : normed;

      // solo estados del chofer (listo_chofer / chofer)
      const onlyAllowed = onlyMine.filter((b) => ALLOWED_SET.has(normalizeStatusKey(b?.status)));

      setBikes(onlyAllowed);
    } catch (e) {
      console.error(e);
      alert("No se pudieron cargar bicicletas.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  /* ====================== CONTADORES (solo 2 estados) ====================== */
  const statusCounts = useMemo(() => {
    const acc = { listo_chofer: 0, chofer: 0 };
    for (const b of bikes) {
      const s = normalizeStatusKey(b?.status);
      if (s === "listo_chofer") acc.listo_chofer++;
      else if (s === "chofer") acc.chofer++;
    }
    return acc;
  }, [bikes]);

  const orderedStatusForCounters = useMemo(
    () => ALLOWED_STATUSES_CHOFER.filter((s) => (statusCounts[s] ?? 0) > 0),
    [statusCounts]
  );

  /* ====================== LISTA (filtros + búsqueda) ====================== */
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

  /* ====================== Acciones del Chofer (solo estados propios) ====================== */
  const toListoChofer = (bike) => updateBike(bike.id, { status: "listo_chofer" });
  const toChofer      = (bike) => updateBike(bike.id, { status: "chofer" });
  const toEntregada   = (bike) => updateBike(bike.id, { status: "entregada" });

  /* ====================== Comentarios por estado (modal) ====================== */
  const openCommentsModal = (bike, initialTab = (bike && bike.status) || "chofer") => {
    const normalizedInitial = STATUS_ALIASES[initialTab] || normalizeStatusKey(initialTab);
    const safeTab = COMMENT_KEYS.includes(normalizedInitial) ? normalizedInitial : "chofer";
    setCommentsModal({ bike, activeTab: safeTab, temp: normalizeComments(bike?.comments || {}) });
  };

  const saveComments = async () => {
    if (!commentsModal || !commentsModal?.bike?.id) { setCommentsModal(null); return; }
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

  /* ====================== Modal: lista por estado ====================== */
  function StatusListModal({ status, items, onClose }) {
    const nice = getStatusDisplayName(status) || status;
    return (
      <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
        <div className="bg-white border border-gray-200 w-full max-w-5xl rounded-2xl p-6 relative shadow-xl text-gray-900">
          <button onClick={onClose} className="absolute top-3 right-3 bg-red-600 text-white px-3 py-1 rounded" type="button">✕</button>
          <h3 className="text-2xl font-bold mb-4">{nice} — {items.length} bicicleta(s)</h3>

          {items.length === 0 ? (
            <p className="text-gray-600">No hay bicicletas en este estado.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-[65vh] overflow-auto">
              {items.map((bike) => (
                <div key={bike.id} className="p-4 rounded-xl shadow-sm border bg-white border-gray-200 flex flex-col gap-3">
                  <div className="flex justify-between items-start">
                    <div className="inline-block px-2 py-1 rounded-full bg-gray-100 text-xs font-semibold text-gray-800 border border-gray-200">
                      {getStatusDisplayName(bike.status) || bike.status}
                    </div>
                    <button type="button" onClick={() => openCommentsModal(bike)} className="text-xs text-teal-700 font-semibold hover:underline">Comentarios</button>
                  </div>

                  <div>
                    <h4 className="text-lg font-semibold">{bike.clientName} {bike.clientLastName}</h4>
                    <p className="text-sm text-gray-600">{bike.bikeBrand} {bike.bikeModel}</p>
                    {bike.description && (<p className="text-sm text-gray-700">Problema: {bike.description}</p>)}
                    {bike.entryDate && (<p className="text-xs text-gray-500">Entrada: {String(bike.entryDate).slice(0,10)}</p>)}
                  </div>

                  <div className="space-y-2">
                    <textarea
                      placeholder="Nota rápida para 'chofer'…"
                      value={editingNote[bike.id] || ""}
                      onChange={(e) => setEditingNote((p) => ({ ...p, [bike.id]: e.target.value }))}
                      className="w-full px-3 py-2 rounded-lg bg:white border border-gray-300 text-gray-900"
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <button type="button" onClick={() => setEditingNote((p) => ({ ...p, [bike.id]: "" }))} className="px-3 py-2 rounded-lg bg-gray-100 border border-gray-300 hover:bg-gray-200">Limpiar</button>
                      <button type="button" onClick={() => updateBike(bike.id, { comments: { ...(bike.comments || {}), chofer: ((bike.comments?.chofer || "") + (editingNote[bike.id] ? (bike.comments?.chofer ? "\n" : "") + editingNote[bike.id] : "")) } })} className="px-3 py-2 rounded-lg bg-gray-900 hover:bg-gray-950 text-white">Guardar Nota</button>
                      <button type="button" onClick={() => toListoChofer(bike)} className="px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text:white">→ Listo Chofer</button>
                      <button type="button" onClick={() => toChofer(bike)} className="px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text:white">→ En Chofer</button>
                      <button type="button" onClick={() => toEntregada(bike)} className="px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text:white col-span-2">→ Entregada</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="flex justify-end mt-6">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 border border-gray-300">Cerrar</button>
          </div>
        </div>
      </div>
    );
  }

  /* ====================== UI ====================== */
  const [statusModal, setStatusModal] = useState(null); // { status }

  if (loading) {
    return <div className="p-6 text-gray-600">Cargando…</div>; // modo claro
  }

  return (
    <div className="p-6 bg-white text-gray-900 min-h-screen">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between mb-6">
        <h2 className="text-3xl font-bold">Panel – Chofer</h2>

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
              {ALLOWED_STATUSES_CHOFER.map((s) => (
                <option key={s} value={s}>{getStatusDisplayName(s) || s}</option>
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

      {/* Contadores (solo 2 estados, ocultan 0 y abren modal) */}
      <div className="mb-8">
        <h3 className="text-2xl font-bold mb-4">Contadores</h3>
        {orderedStatusForCounters.length === 0 ? (
          <p className="text-gray-600">Sin elementos en cola.</p>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            {orderedStatusForCounters.map((status) => (
              <button
                key={status}
                type="button"
                onClick={() => setStatusModal({ status })}
                className="p-4 rounded-xl shadow-sm text-center transition bg-white border border-gray-200 hover:border-gray-300 hover:shadow"
                title={`Ver ${getStatusDisplayName(status) || status}`}
              >
                <p className="text-gray-600 text-sm font-medium">{getStatusDisplayName(status) || status}</p>
                <p className="text-3xl font-bold text-gray-900">{statusCounts[status] ?? 0}</p>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Lista de bicicletas (tarjetas) */}
      <h3 className="text-2xl font-bold mb-6">Mis bicicletas</h3>
      {visibleBikes.length === 0 ? (
        <p className="text-gray-600">No hay bicicletas asignadas en estos estados.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {visibleBikes.map((bike) => (
            <div key={bike.id} className="p-6 rounded-2xl shadow-md border bg-white border-gray-200 flex flex-col gap-4">
              <div className="flex justify-between items-start">
                <div className="inline-block px-3 py-1 rounded-full bg-gray-100 text-sm font-semibold text-gray-800 border border-gray-200">
                  {getStatusDisplayName(bike.status) || bike.status}
                </div>
                <div className="flex gap-2">
                  <button type="button" onClick={() => openCommentsModal(bike)} className="text-sm text-teal-700 font-semibold hover:underline">Comentarios</button>
                  <button type="button" onClick={() => setActiveBikeModal({ bike })} className="text-sm text-indigo-700 font-semibold hover:underline">Abrir</button>
                </div>
              </div>

              <div>
                <h4 className="text-xl font-semibold">{bike.clientName} {bike.clientLastName}</h4>
                <p className="text-sm text-gray-600">Modelo: {bike.bikeModel} / Marca: {bike.bikeBrand}</p>
                {bike.description && (<p className="text-sm text-gray-700">Problema: {bike.description}</p>)}
                {bike.entryDate && (<p className="text-xs text-gray-500">Entrada: {String(bike.entryDate).slice(0,10)}</p>)}
              </div>

              <div className="space-y-2">
                <textarea
                  placeholder="Nota para 'chofer' (comments.chofer)…"
                  value={editingNote[bike.id] || ""}
                  onChange={(e) => setEditingNote((p) => ({ ...p, [bike.id]: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg bg-white border border-gray-300 text-gray-900"
                />
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => updateBike(bike.id, { comments: { ...(bike.comments || {}), chofer: ((bike.comments?.chofer || "") + (editingNote[bike.id] ? (bike.comments?.chofer ? "\n" : "") + editingNote[bike.id] : "")) } })} className="px-4 py-2 rounded-lg bg-gray-100 border border-gray-300 hover:bg-gray-200">Guardar Nota</button>
                  <button type="button" onClick={() => toListoChofer(bike)} className="px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white">→ Listo Chofer</button>
                  <button type="button" onClick={() => toChofer(bike)} className="px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white">→ En Chofer</button>
                  <button type="button" onClick={() => toEntregada(bike)} className="px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white col-span-2">→ Entregada</button>
                </div>
              </div>

              {/* Resumen de comentarios */}
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
          ))}
        </div>
      )}

      {/* ======================= MODAL: COMENTARIOS POR ESTADO ======================= */}
      {commentsModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-gray-200 w-full max-w-2xl rounded-2xl p-6 relative shadow-xl text-gray-900">
            <button onClick={() => setCommentsModal(null)} className="absolute top-3 right-3 bg-red-600 text-white px-3 py-1 rounded" type="button">✕</button>

            <h3 className="text-2xl font-bold mb-4">Comentarios — {commentsModal.bike.clientName} {commentsModal.bike.clientLastName}</h3>

            <div className="flex flex-wrap gap-2 mb-4">
              {COMMENT_KEYS.map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setCommentsModal((m) => ({ ...m, activeTab: k }))}
                  className={`px-3 py-1 rounded-full border text-sm ${commentsModal.activeTab === k ? "bg-gray-900 text-white border-gray-800" : "bg-white hover:bg-gray-50 border-gray-300 text-gray-800"}`}
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
                onChange={(e) => setCommentsModal((m) => ({ ...m, temp: { ...(m.temp || {}), [m.activeTab]: e.target.value } }))}
              />
              <p className="text-xs text-gray-500 mt-1">Se guarda en <code>comments["{commentsModal.activeTab}"]</code>.</p>
            </div>

            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setCommentsModal(null)} className="px-4 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 border border-gray-300">Cancelar</button>
              <button type="button" onClick={saveComments} className="px-5 py-2 rounded-xl bg-gray-900 text-white">Guardar Comentarios</button>
            </div>
          </div>
        </div>
      )}

      {/* ======================= MODAL: LISTA POR ESTADO ======================= */}
      {statusModal && (
        <StatusListModal
          status={statusModal.status}
          items={bikes.filter((b) => normalizeStatusKey(b.status) === normalizeStatusKey(statusModal.status))}
          onClose={() => setStatusModal(null)}
        />
      )}

      {/* ======================= MODAL: ACCIONES INTERACTIVAS (tarjeta) ======================= */}
      {activeBikeModal && (
        <StatusListModal
          status={activeBikeModal.bike.status}
          items={[activeBikeModal.bike]}
          onClose={() => setActiveBikeModal(null)}
        />
      )}
    </div>
  );
}
