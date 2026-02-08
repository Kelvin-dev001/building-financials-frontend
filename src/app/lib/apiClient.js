"use client";

import { supabase } from "./supabaseClient";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "https://building-financials-backend.onrender.com";

async function getAccessToken() {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session?.access_token || null;
}

async function refreshSession() {
  const { data, error } = await supabase.auth.refreshSession();
  if (error) throw error;
  return data.session?.access_token || null;
}

export async function apiFetch(path, options = {}) {
  const url = `${API_BASE}${path}`;
  let token = await getAccessToken();

  const doFetch = async (authToken) =>
    fetch(url, {
      ...options,
      headers: {
        ...(options.headers || {}),
        Authorization: authToken ? `Bearer ${authToken}` : undefined
      }
    });

  let res = await doFetch(token);

  // If unauthorized, attempt refresh once
  if (res.status === 401) {
    token = await refreshSession();
    res = await doFetch(token);
  }

  // If still unauthorized, sign out & bubble
  if (res.status === 401) {
    await supabase.auth.signOut();
    throw new Error("Session expired. Please sign in again.");
  }

  return res;
}