"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "../lib/supabaseClient";

function useToasts() {
  const [toasts, setToasts] = useState([]);
  const add = (message, type = "success") => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => remove(id), 4000);
  };
  const remove = (id) => setToasts((prev) => prev.filter((t) => t.id !== id));
  return { toasts, add, remove };
}

function Toasts({ toasts, remove }) {
  return (
    <div className="toast-container">
      {toasts.map((t) => (
        <div key={t.id} className={`toast ${t.type === "error" ? "toast-error" : "toast-success"}`}>
          <div className="flex justify-between gap-3">
            <span>{t.message}</span>
            <button onClick={() => remove(t.id)} className="text-ink/60 font-bold">×</button>
          </div>
        </div>
      ))}
    </div>
  );
}

// Lightweight token-aware fetch
async function getValidSession() {
  const { data } = await supabase.auth.getSession();
  if (data.session) return data.session;
  const { data: refreshed } = await supabase.auth.refreshSession();
  return refreshed.session ?? null;
}
async function apiFetch(path, { method = "GET", body } = {}) {
  const session = await getValidSession();
  const headers = { "Content-Type": "application/json" };
  if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`;
  const res = await fetch(path, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || "Request failed");
  return json;
}

function MaterialRow({ item, onChange, onRemove }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-5 gap-2 items-center">
      <input className="input" placeholder="Description" value={item.description} onChange={(e) => onChange({ ...item, description: e.target.value })} />
      <input className="input" placeholder="Supplier" value={item.supplier} onChange={(e) => onChange({ ...item, supplier: e.target.value })} />
      <input className="input" type="number" step="0.01" placeholder="Qty" value={item.quantity} onChange={(e) => onChange({ ...item, quantity: e.target.value })} />
      <input className="input" type="number" step="0.01" placeholder="Unit Cost" value={item.unit_cost} onChange={(e) => onChange({ ...item, unit_cost: e.target.value })} />
      <div className="flex items-center gap-2">
        <div className="text-sm text-ink/80">{(Number(item.quantity || 0) * Number(item.unit_cost || 0)).toFixed(2)}</div>
        <button className="btn-ghost" type="button" onClick={onRemove}>×</button>
      </div>
    </div>
  );
}

function LabourRow({ item, onChange, onRemove }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-5 gap-2 items-center">
      <input className="input" placeholder="Labourer" value={item.labourer_name} onChange={(e) => onChange({ ...item, labourer_name: e.target.value })} />
      <input className="input" placeholder="Role" value={item.role} onChange={(e) => onChange({ ...item, role: e.target.value })} />
      <input className="input" type="number" step="0.01" placeholder="Rate/Day" value={item.rate_per_day} onChange={(e) => onChange({ ...item, rate_per_day: e.target.value })} />
      <input className="input" type="number" step="0.01" placeholder="Total Paid" value={item.total_paid} onChange={(e) => onChange({ ...item, total_paid: e.target.value })} />
      <button className="btn-ghost" type="button" onClick={onRemove}>×</button>
    </div>
  );
}

export default function DailyJournalPage() {
  const apiBase = process.env.NEXT_PUBLIC_API_BASE || "https://building-financials-backend.onrender.com";
  const { toasts, add: addToast, remove: removeToast } = useToasts();

  const [me, setMe] = useState(null);
  const [session, setSession] = useState(null);
  const [tab, setTab] = useState("materials"); // materials | labour | summary | analytics

  // Forms
  const [matDate, setMatDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [matItems, setMatItems] = useState([{ description: "", supplier: "", quantity: "", unit_cost: "" }]);
  const [matFile, setMatFile] = useState(null);

  const [labDate, setLabDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [labItems, setLabItems] = useState([{ labourer_name: "", role: "", rate_per_day: "", total_paid: "" }]);

  // Lists
  const [materials, setMaterials] = useState([]);
  const [labours, setLabours] = useState([]);
  const [summary, setSummary] = useState({ totals: {}, heatmap: {} });

  // Pagination
  const [pageM, setPageM] = useState(1);
  const [pageL, setPageL] = useState(1);
  const limit = 10;

  // Filters
  const [filterStart, setFilterStart] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 30); return d.toISOString().slice(0,10);
  });
  const [filterEnd, setFilterEnd] = useState(() => new Date().toISOString().slice(0,10));

  // Session
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session ?? null));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, sess) => setSession(sess));
    return () => listener.subscription.unsubscribe();
  }, []);

  const fetchMe = useCallback(async () => {
    if (!session?.access_token) return;
    try {
      const headers = { Authorization: `Bearer ${session.access_token}` };
      const res = await fetch(`${apiBase}/api/me`, { headers });
      const json = await res.json();
      if (res.ok) setMe(json);
    } catch (err) {
      addToast(err.message, "error");
    }
  }, [apiBase, session, addToast]);

  const loadMaterials = useCallback(async () => {
    if (!session?.access_token) return;
    try {
      const headers = { Authorization: `Bearer ${session.access_token}` };
      const res = await fetch(`${apiBase}/api/daily/materials?page=${pageM}&limit=${limit}&startDate=${filterStart}&endDate=${filterEnd}`, { headers });
      const json = await res.json();
      if (res.ok) setMaterials(json.data || []);
      else addToast(json.error || "Error loading materials", "error");
    } catch (err) {
      addToast(err.message, "error");
    }
  }, [apiBase, session, pageM, filterStart, filterEnd, addToast]);

  const loadLabour = useCallback(async () => {
    if (!session?.access_token) return;
    try {
      const headers = { Authorization: `Bearer ${session.access_token}` };
      const res = await fetch(`${apiBase}/api/daily/labour?page=${pageL}&limit=${limit}&startDate=${filterStart}&endDate=${filterEnd}`, { headers });
      const json = await res.json();
      if (res.ok) setLabours(json.data || []);
      else addToast(json.error || "Error loading labour", "error");
    } catch (err) {
      addToast(err.message, "error");
    }
  }, [apiBase, session, pageL, filterStart, filterEnd, addToast]);

  const loadSummary = useCallback(async () => {
    if (!session?.access_token) return;
    try {
      const headers = { Authorization: `Bearer ${session.access_token}` };
      const res = await fetch(`${apiBase}/api/daily/summary?startDate=${filterStart}&endDate=${filterEnd}`, { headers });
      const json = await res.json();
      if (res.ok) setSummary(json);
    } catch (err) {
      addToast(err.message, "error");
    }
  }, [apiBase, session, filterStart, filterEnd, addToast]);

  useEffect(() => {
    fetchMe();
  }, [fetchMe]);

  useEffect(() => {
    loadMaterials();
    loadLabour();
    loadSummary();
  }, [loadMaterials, loadLabour, loadSummary]);

  // Submit materials
  const submitMaterials = async (e) => {
    e.preventDefault();
    if (!matItems.length) return addToast("Add at least one item", "error");
    const formData = new FormData();
    formData.append("entry_date", matDate);
    formData.append("items", JSON.stringify(matItems));
    if (matFile) formData.append("file", matFile);
    try {
      const session = await getValidSession();
      const headers = session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {};
      const res = await fetch(`${apiBase}/api/daily/materials`, { method: "POST", headers, body: formData });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed");
      addToast("Materials submitted");
      setMatItems([{ description: "", supplier: "", quantity: "", unit_cost: "" }]);
      setMatFile(null);
      loadMaterials();
      loadSummary();
    } catch (err) {
      addToast(err.message, "error");
    }
  };

  // Submit labour
  const submitLabour = async (e) => {
    e.preventDefault();
    if (!labItems.length) return addToast("Add at least one labourer", "error");
    try {
      await apiFetch(`${apiBase}/api/daily/labour`, {
        method: "POST",
        body: { entry_date: labDate, workers: labItems }
      });
      addToast("Labour submitted");
      setLabItems([{ labourer_name: "", role: "", rate_per_day: "", total_paid: "" }]);
      loadLabour();
      loadSummary();
    } catch (err) {
      addToast(err.message, "error");
    }
  };

  const viewReceipt = async (expenseId) => {
    try {
      const headers = { Authorization: `Bearer ${(await getValidSession())?.access_token}` };
      const res = await fetch(`${apiBase}/api/expenses/${expenseId}/receipt-url`, { headers });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed");
      window.open(json.url, "_blank", "noopener,noreferrer");
    } catch (err) {
      addToast(err.message, "error");
    }
  };

  const matTotal = matItems.reduce((sum, it) => sum + Number(it.quantity || 0) * Number(it.unit_cost || 0), 0);
  const labTotal = labItems.reduce((sum, it) => sum + Number(it.total_paid || 0), 0);

  return (
    <div className="space-y-6 pb-24">
      <Toasts toasts={toasts} remove={removeToast} />

      <header className="section">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold text-ink">Daily Cost Journal</h1>
          <p className="subtle">Materials & Labour tracking with ledger integration</p>
          {me && <div className="badge">Role: {me.role}</div>}
        </div>
      </header>

      <section className="section">
        <div className="flex gap-2 flex-wrap">
          {["materials", "labour", "summary", "analytics"].map((t) => (
            <button key={t} className={`btn ${tab === t ? "btn-primary" : "btn-ghost"}`} onClick={() => setTab(t)}>
              {t[0].toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>
      </section>

      {tab === "materials" && (
        <section className="section">
          <h3 className="heading">Materials Entry</h3>
          <form onSubmit={submitMaterials} className="space-y-3">
            <div>
              <label className="label">Date</label>
              <input className="input" type="date" value={matDate} onChange={(e) => setMatDate(e.target.value)} required />
            </div>
            <div className="flex flex-col gap-2">
              {matItems.map((it, idx) => (
                <MaterialRow
                  key={idx}
                  item={it}
                  onChange={(v) => {
                    const copy = [...matItems];
                    copy[idx] = v;
                    setMatItems(copy);
                  }}
                  onRemove={() => setMatItems((prev) => prev.filter((_, i) => i !== idx))}
                />
              ))}
              <button className="btn-ghost w-full sm:w-auto" type="button" onClick={() => setMatItems((prev) => [...prev, { description: "", supplier: "", quantity: "", unit_cost: "" }])}>
                Add Another Item
              </button>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
              <div className="text-sm font-semibold">Daily Total: {matTotal.toFixed(2)}</div>
              <input type="file" accept=".pdf" onChange={(e) => setMatFile(e.target.files?.[0] || null)} className="input" />
            </div>
            <button className="btn-primary" type="submit">Submit Materials</button>
          </form>
          <div className="mt-6">
            <h4 className="heading">Recent Entries</h4>
            <div className="grid gap-3">
              {materials.map((m) => (
                <div key={m.id} className="glass p-4">
                  <div className="flex justify-between items-center">
                    <div className="font-semibold">{m.entry_date}</div>
                    <span className="badge">{m.editable ? "Editable" : "Locked"}</span>
                  </div>
                  <div className="text-sm">Total: {m.total_cost}</div>
                  <ul className="text-sm list-disc ml-4">
                    {(m.material_items || []).map((it) => (
                      <li key={it.id}>{it.description} — {it.supplier || "Unknown"} — {it.quantity} × {it.unit_cost} = {it.total_cost}</li>
                    ))}
                  </ul>
                </div>
              ))}
              {materials.length === 0 && <p className="subtle">No material entries.</p>}
            </div>
          </div>
        </section>
      )}

      {tab === "labour" && (
        <section className="section">
          <h3 className="heading">Labour Entry</h3>
          <form onSubmit={submitLabour} className="space-y-3">
            <div>
              <label className="label">Date</label>
              <input className="input" type="date" value={labDate} onChange={(e) => setLabDate(e.target.value)} required />
            </div>
            <div className="flex flex-col gap-2">
              {labItems.map((it, idx) => (
                <LabourRow
                  key={idx}
                  item={it}
                  onChange={(v) => {
                    const copy = [...labItems];
                    copy[idx] = v;
                    setLabItems(copy);
                  }}
                  onRemove={() => setLabItems((prev) => prev.filter((_, i) => i !== idx))}
                />
              ))}
              <button className="btn-ghost w-full sm:w-auto" type="button" onClick={() => setLabItems((prev) => [...prev, { labourer_name: "", role: "", rate_per_day: "", total_paid: "" }])}>
                Add Another Labourer
              </button>
            </div>
            <div className="text-sm font-semibold">Daily Total: {labTotal.toFixed(2)}</div>
            <button className="btn-primary" type="submit">Submit Labour</button>
          </form>
          <div className="mt-6">
            <h4 className="heading">Recent Entries</h4>
            <div className="grid gap-3">
              {labours.map((l) => (
                <div key={l.id} className="glass p-4">
                  <div className="flex justify-between items-center">
                    <div className="font-semibold">{l.entry_date}</div>
                    <span className="badge">{l.editable ? "Editable" : "Locked"}</span>
                  </div>
                  <div className="text-sm">Total: {l.total_paid}</div>
                  <ul className="text-sm list-disc ml-4">
                    {(l.labour_items || []).map((it) => (
                      <li key={it.id}>{it.labourer_name} — {it.role || "N/A"} — Rate {it.rate_per_day} — Paid {it.total_paid}</li>
                    ))}
                  </ul>
                </div>
              ))}
              {labours.length === 0 && <p className="subtle">No labour entries.</p>}
            </div>
          </div>
        </section>
      )}

      {tab === "summary" && (
        <section className="section">
          <h3 className="heading">Daily Summary</h3>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            <div className="glass p-3">
              <div className="font-semibold">Materials</div>
              <div>{summary.totals?.materials ?? 0}</div>
            </div>
            <div className="glass p-3">
              <div className="font-semibold">Labour</div>
              <div>{summary.totals?.labour ?? 0}</div>
            </div>
            <div className="glass p-3">
              <div className="font-semibold">Other</div>
              <div>{summary.totals?.other ?? 0}</div>
            </div>
            <div className="glass p-3">
              <div className="font-semibold">Combined</div>
              <div>{summary.totals?.combined ?? 0}</div>
            </div>
          </div>
          <div className="mt-3">
            <button className="btn-primary" onClick={() => window.location.href = `${apiBase}/api/daily/export/excel`}>Download Excel</button>
          </div>
        </section>
      )}

      {tab === "analytics" && (
        <section className="section">
          <h3 className="heading">Expense Heatmap</h3>
          <p className="subtle">Heatmap placeholder (bind summary.heatmap to a calendar component if you add one).</p>
        </section>
      )}
    </div>
  );
}