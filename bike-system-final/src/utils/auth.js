// src/utils/auth.js
const KEY = "user";

export function setUser(u) {
  try { localStorage.setItem(KEY, JSON.stringify(u)); } catch {}
}
export function getUser() {
  try { const raw = localStorage.getItem(KEY); return raw ? JSON.parse(raw) : null; } catch { return null; }
}
export function clearUser() {
  try { localStorage.removeItem(KEY); } catch {}
}

// Normaliza string de rol a uno de estos: admin, mecanico, tienda, chofer, lavador
export function normalizeRole(r) {
  if (!r) return "";
  const s = String(r).trim().toLowerCase();
  if (["admin", "administrador", "administrator"].includes(s)) return "admin";
  if (["mecanico", "mecánico", "mechanic"].includes(s)) return "mecanico";
  if (["tienda", "store"].includes(s)) return "tienda";
  if (["chofer", "driver"].includes(s)) return "chofer";
  if (["lavador", "wash", "lavado"].includes(s)) return "lavador";
  return s; // deja pasar por si usas otro
}

export function dashboardPathFor(role) {
  const r = normalizeRole(role);
  return ({
    admin: "/admin",
    mecanico: "/mecanico",
    tienda: "/tienda",
    chofer: "/chofer",
    lavador: "/lavador",
  }[r]) || "/";
}
