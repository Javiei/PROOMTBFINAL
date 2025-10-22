// src/components/Lavador.js
import React, { useEffect, useMemo, useState, useCallback } from "react";
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
  const ct = res.headers.get("content-type") || "";
  if (!ct.includes("application/json")) return {};
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

/* ========= Pestañas de comentarios disponibles ========= */
const COMMENT_KEYS = [
  "lavado",
  "tienda",
  "mecanico",
  "admin",
  "chofer",
  "por cotizar",
  "en cotizacion",
  "en reparacion",
  "listo_tienda",
  "listo_chofer",
  "terminado",
  "entregada",
];

/* =============================== COMPONENTE =============================== */
export default function Lavador() {
  const [bikes, setBikes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Modal comentarios
  const [commentsModal, setCommentsModal] = useState(null); // { bike, activeTab, temp }

  // Nota rápida por tarjeta
  const [editingNote, setEditingNote] = useState({});

  /* ===================== CARGA: SOLO LAVADO ===================== */
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      // 🚀 Trae SOLO las bicis en 'lavado' desde el backend
      const data = await fetchJSON("/api/bikes/bucket/lavado");
      const normalized = (Array.isArray(data) ? data : []).map((b) => ({
        ...b,
        status: normalizeStatusKey(b.status || "lavado"),
        comments: normalizeComments(b.comments),
      }));
      setBikes(normalized);
    } catch (e) {
      console.error(e);
      setError("No se pudieron cargar las bicicletas de Lavado.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  /* ===================== CONTADOR SIMPLE ===================== */
  const countLavado = useMemo(() => bikes.length, [bikes]);

  /* ===================== UPDATE: PUT + GET fresco ===================== */
  async function updateBike(bikeId, patch) {
    try {
      // 1) PUT con el patch
      await fetchJSON(`/api/bikes/${bikeId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });

      // 2) GET la bici actualizada del backend
      const fresh = await fetchJSON(`/api/bikes/${bikeId}`);

      // 3) Normalizar y actualizar en estado local si sigue en 'lavado'
      const normalized = {
        ...fresh,
        status: normalizeStatusKey(fresh?.status || ""),
        comments: normalizeComments(fresh?.comments),
      };

      setBikes((prev) => {
        // Si la bici ya no está en 'lavado', la sacamos de la lista local (esta vista es solo de lavado)
        if (normalized.status !== "lavado") {
          return prev.filter((x) => x.id !== bikeId);
        }
        // Si sigue en 'lavado', la reemplazamos
        const exists = prev.some((x) => x.id === bikeId);
        if (!exists) return [normalized, ...prev];
        return prev.map((x) => (x.id === bikeId ? normalized : x));
      });

      return normalized;
    } catch (e) {
      console.error(e);
      alert("No se pudo actualizar la bicicleta.");
    }
  }

  /* ===================== Acciones rápidas ===================== */
  const keepLavado = (bike) => updateBike(bike.id, { status: "lavado" });
  const markToTienda = (bike) => updateBike(bike.id, { status: "tienda" });
  const markToEnReparacion = (bike) =>
    updateBike(bike.id, { status: "en reparacion" });

  /* ===================== Notas rápidas ===================== */
  const handleNoteChange = (id, value) =>
    setEditingNote((p) => ({ ...p, [id]: value }));

  const saveQuickNoteToLavado = async (bike) => {
    const note = (editingNote[bike.id] || "").trim();
    if (!note) return;
    const current = bike.comments?.lavado || "";
    const merged = current ? `${current}\n${note}` : note;
    await updateBike(bike.id, {
      comments: { ...(bike.comments || {}), lavado: merged },
    });
    setEditingNote((p) => ({ ...p, [bike.id]: "" }));
  };

  /* ===================== Modal de comentarios ===================== */
  const openCommentsModal = (
    bike,
    initialTab = normalizeStatusKey(bike?.status || "lavado")
  ) => {
    const safeTab = COMMENT_KEYS.includes(initialTab) ? initialTab : "lavado";
    setCommentsModal({
      bike,
      activeTab: safeTab,
      temp: normalizeComments(bike?.comments || {}),
    });
  };

  const saveComments = async () => {
    if (!commentsModal?.bike?.id) {
      setCommentsModal(null);
      return;
    }
    const { bike, temp } = commentsModal;
    try {
      await updateBike(bike.id, { comments: temp });
      setCommentsModal(null);
      alert("Comentarios guardados.");
    } catch (e) {
      console.error(e);
      alert("No se pudieron guardar los comentarios.");
    }
  };

  /* ===================== UI ===================== */
  if (loading) return <div className="p-6 text-gray-900">Cargando…</div>;
  if (error)
    return (
      <div className="p-6 text-red-700">
        {error}{" "}
        <button
          onClick={load}
          className="ml-2 px-3 py-1 rounded bg-white border border-gray-300 hover:bg-gray-50"
        >
          Reintentar
        </button>
      </div>
    );

  return (
    <div className="p-6 bg-gray-50 text-gray-900 min-h-screen">
      <div className="flex items-center gap-3 mb-6">
        <h2 className="text-3xl font-bold">Panel – Lavador</h2>
        <div className="ml-auto flex items-center gap-3">
          <div className="px-3 py-1 rounded-lg bg-white border border-gray-200">
            <span className="text-sm text-gray-600">En Lavado:</span>{" "}
            <span className="text-xl font-bold text-gray-900">{countLavado}</span>
          </div>
          <button
            onClick={load}
            className="px-3 py-1 rounded-lg bg-white hover:bg-gray-50 text-sm border border-gray-300"
            title="Recargar"
            type="button"
          >
            Recargar
          </button>
        </div>
      </div>

      {bikes.length === 0 ? (
        <p className="text-gray-600">No hay bicicletas en Lavado.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {bikes.map((bike) => (
            <div
              key={bike.id}
              className="p-6 rounded-2xl shadow-sm border bg-white border-gray-200 flex flex-col gap-4"
            >
              <div className="flex justify-between items-start">
                <div className="inline-block px-3 py-1 rounded-full bg-gray-100 text-sm font-semibold text-gray-700">
                  {getStatusDisplayName(bike.status) || bike.status}
                </div>
                <button
                  type="button"
                  onClick={() => openCommentsModal(bike)}
                  className="text-sm text-indigo-600 font-semibold hover:underline"
                  title="Comentarios por estado"
                >
                  Comentarios
                </button>
              </div>

              <div>
                <h4 className="text-xl font-semibold">
                  {bike.clientName} {bike.clientLastName}
                </h4>
                <p className="text-sm text-gray-700">
                  Marca: {bike.bikeBrand || "—"} / Modelo: {bike.bikeModel || "—"}
                </p>
                {bike.description && (
                  <p className="text-sm text-gray-700">
                    Problema: {bike.description}
                  </p>
                )}
                {bike.problem && (
                  <p className="text-sm text-gray-900 font-medium">
                    Diagnóstico: {bike.problem}
                  </p>
                )}
                {bike.entryDate && (
                  <p className="text-xs text-gray-500">
                    Entrada: {String(bike.entryDate).slice(0, 10)}
                  </p>
                )}
              </div>

              {/* Nota rápida / acciones */}
              <div className="space-y-2">
                <textarea
                  placeholder="Nota rápida para 'lavado' (se guarda en comments.lavado)…"
                  value={editingNote[bike.id] || ""}
                  onChange={(e) => handleNoteChange(bike.id, e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-white border border-gray-300"
                />
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => saveQuickNoteToLavado(bike)}
                    className="px-4 py-2 rounded-lg bg-white border border-gray-300 hover:bg-gray-50"
                  >
                    Guardar Nota
                  </button>
                  <button
                    type="button"
                    onClick={() => keepLavado(bike)}
                    className="flex-1 px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700"
                    title="Mantener en 'Lavado'"
                  >
                    Mantener Lavado
                  </button>
                  <button
                    type="button"
                    onClick={() => markToTienda(bike)}
                    className="flex-1 px-4 py-2 rounded-lg bg-green-600 text-white hover:bg-green-700"
                    title="Enviar a Tienda"
                  >
                    → Tienda
                  </button>
                  <button
                    type="button"
                    onClick={() => markToEnReparacion(bike)}
                    className="flex-1 px-4 py-2 rounded-lg bg-amber-600 text-white hover:bg-amber-700"
                    title="Enviar a Reparación"
                  >
                    → Reparación
                  </button>
                </div>
              </div>

              {/* Resumen de comentarios */}
              <div className="mt-2">
                <details className="rounded-lg border border-gray-200 bg-white">
                  <summary className="cursor-pointer px-3 py-2 text-sm text-gray-700">
                    Ver comentarios (resumen)
                  </summary>
                  <div className="px-3 py-2 text-sm text-gray-700 space-y-2">
                    {Object.keys(bike.comments || {}).length === 0 ? (
                      <p className="text-gray-500 italic">Sin comentarios.</p>
                    ) : (
                      Object.entries(bike.comments).map(([k, v]) => (
                        <div key={k}>
                          <p className="text-gray-600 font-semibold">
                            {getStatusDisplayName(k) || k}
                          </p>
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
        <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-gray-200 w-full max-w-2xl rounded-2xl p-6 relative shadow-xl text-gray-900">
            <button
              onClick={() => setCommentsModal(null)}
              className="absolute top-3 right-3 bg-red-600 text-white px-3 py-1 rounded"
              type="button"
            >
              ✕
            </button>

            <h3 className="text-2xl font-bold mb-4">
              Comentarios — {commentsModal.bike.clientName}{" "}
              {commentsModal.bike.clientLastName}
            </h3>

            <div className="flex flex-wrap gap-2 mb-4">
              {COMMENT_KEYS.map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() =>
                    setCommentsModal((m) => ({
                      ...m,
                      activeTab: k,
                    }))
                  }
                  className={`px-3 py-1 rounded-full border text-sm ${
                    commentsModal.activeTab === k
                      ? "bg-black text-white border-gray-700"
                      : "bg-white hover:bg-gray-50 border-gray-300"
                  }`}
                >
                  {getStatusDisplayName(k) || k}
                </button>
              ))}
            </div>

            <div className="mb-4">
              <textarea
                className="w-full border rounded-xl p-3 min-h-[140px] bg-white border-gray-300"
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
                Se guarda junto a la bicicleta en{" "}
                <code>comments["{commentsModal.activeTab}"]</code>.
              </p>
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setCommentsModal(null)}
                className="px-4 py-2 rounded-xl bg-white border border-gray-300 hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={saveComments}
                className="px-5 py-2 rounded-xl bg-black text-white border border-gray-800"
              >
                Guardar Comentarios
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
