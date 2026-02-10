"use client";

import { supabase } from "./supabaseClient";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "https://building-financials-backend.onrender.com";

let refreshPromise = null;

async function refreshSessionOnce() {
  if (!refreshPromise) {
    refreshPromise = supabase.auth.refreshSession().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

async function getToken() {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  if (!data.session) return null;

  const expiresAt = data.session.expires_at ? data.session.expires_at * 1000 : 0;
  if (expiresAt && expiresAt - Date.now() < 2 * 60 * 1000) {
    const { data: refreshed, error: refreshErr } = await refreshSessionOnce();
    if (refreshErr) throw refreshErr;
    return refreshed.session?.access_token ?? null;
  }

  return data.session.access_token;
}

export async function apiFetch(path, options = {}) {
  const token = await getToken();

  const headers = {
    ...(options.headers || {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {})
  };

  if (!(options.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }

  return fetch(`${API_BASE}${path}`, {
    ...options,
    headers
  });
}