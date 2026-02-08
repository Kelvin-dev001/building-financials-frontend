"use client";

import { supabase } from "./supabaseClient";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "https://building-financials-backend.onrender.com";

async function getToken() {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  if (!data.session) return null;

  // If expiring within 2 minutes, refresh
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
  const headers = {
    ...(options.headers || {}),
    "Content-Type": options.body instanceof FormData ? undefined : "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {})
  };

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  if (res.status === 401) {
    await supabase.auth.signOut();
    throw new Error("Session expired. Please sign in again.");
  }
  return res;
}