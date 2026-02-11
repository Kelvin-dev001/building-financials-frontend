"use client";

import { supabase } from "./supabaseClient";

const RAW_BASE = process.env.NEXT_PUBLIC_API_BASE || "https://building-financials-backend.onrender.com";

function normalizeBase(base) {
  return base.replace(/\/+$/, "");
}

function normalizePath(path) {
  if (!path.startsWith("/")) return `/${path}`;
  return path;
}

async function getToken() {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  if (!data.session) return null;

  const expiresAt = data.session.expires_at ? data.session.expires_at * 1000 : 0;
  if (expiresAt && expiresAt - Date.now() < 2 * 60 * 1000) {
    const { data: refreshed, error: refreshErr } = await supabase.auth.refreshSession();
    if (refreshErr) throw refreshErr;
    return refreshed.session?.access_token ?? null;
  }
  return data.session.access_token;
}

export async function apiFetch(path, options = {}) {
  const token = await getToken();
  const base = normalizeBase(RAW_BASE);
  let finalPath = normalizePath(path);

  // If API_BASE already includes /api and path includes /api, drop one.
  if (base.endsWith("/api") && finalPath.startsWith("/api/")) {
    finalPath = finalPath.replace(/^\/api/, "");
  }

  const headers = {
    ...(options.headers || {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {})
  };

  if (!(options.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }

  const url = `${base}${finalPath}`;
  const res = await fetch(url, { ...options, headers });

  // Fallback: retry once without /api in case backend is mounted at root
  if (res.status === 404 && finalPath.startsWith("/api/")) {
    const retryUrl = `${base}${finalPath.replace(/^\/api/, "")}`;
    return fetch(retryUrl, { ...options, headers });
  }

  return res;
}