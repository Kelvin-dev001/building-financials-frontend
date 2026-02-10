"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { supabase } from "@/lib/supabaseClient";
import { apiFetch } from "@/lib/apiClient";

const PAGE_SIZE = 10;

// Sanitizers to avoid sending "null"/"undefined"/empty strings to the API (prevents timestamp parse errors)
const cleanString = (value) => {
  if (value === undefined || value === null) return null;
  const s = String(value).trim();
  if (!s || s === "null" || s === "undefined") return null;
  return s;
};

const cleanDate = (value) => {
  const s = cleanString(value);
  if (!s) return null;
  const t = Date.parse(s);
  return Number.isNaN(t) ? null : s;
};

function Toasts({ toasts, remove }) {
  return (
    <div className="toast-container">
      {toasts.map((t) => (
        <div key={t.id} className={`toast ${t.type === "error" ? "toast-error" : "toast-success"}`}>
          <div className="flex justify-between gap-3">
            <span>{t.message}</span>
            <button onClick={() => remove(t.id)} className="text-ink/60 font-bold">
              ×
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

function useToasts() {
  const [toasts, setToasts] = useState([]);

  const remove = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const add = useCallback(
    (message, type = "success") => {
      const id = Date.now();
      setToasts((prev) => [...prev, { id, message, type }]);
      setTimeout(() => remove(id), 4000);
    },
    [remove]
  );

  return { toasts, add, remove };
}

const statusOptions = [
  { value: "", label: "Any" },
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" }
];

const roleOptions = [
  { value: "admin", label: "Admin", desc: "Full control & approvals" },
  { value: "investor", label: "Investor", desc: "View contributions & expenses" },
  { value: "developer", label: "Developer", desc: "Log receipts & expenses" }
];

function formatDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleString();
}

export default function Home() {
  const { toasts, add: addToast, remove: removeToast } = useToasts();
  const [tab, setTab] = useState("dashboard");

  const [apiStatus, setApiStatus] = useState("Checking...");
  const [session, setSession] = useState(null);
  const [me, setMe] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [authError, setAuthError] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [selectedRole, setSelectedRole] = useState("");

  const [cFilters, setCFilters] = useState({ startDate: "", endDate: "", status: "", investor_id: "" });
  const [cPage, setCPage] = useState(1);
  const [eFilters, setEFilters] = useState({ startDate: "", endDate: "", status: "", category: "" });
  const [ePage, setEPage] = useState(1);

  const [contribs, setContribs] = useState([]);
  const [contribTotal, setContribTotal] = useState(0);
  const [receipts, setReceipts] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [expenseTotal, setExpenseTotal] = useState(0);
  const [report, setReport] = useState(null);
  const [investorOptions, setInvestorOptions] = useState([]);

  const [loadingContribs, setLoadingContribs] = useState(false);
  const [loadingExpenses, setLoadingExpenses] = useState(false);
  const [loadingReport, setLoadingReport] = useState(false);

  const [contribAmount, setContribAmount] = useState("");
  const [contribNote, setContribNote] = useState("");
  const [contribDateSent, setContribDateSent] = useState("");
  const [selectedContribution, setSelectedContribution] = useState("");
  const [receiptKes, setReceiptKes] = useState("");
  const [receiptFx, setReceiptFx] = useState("");

  const [selectedExpense, setSelectedExpense] = useState("");
  const [commentText, setCommentText] = useState("");

  // Health
  useEffect(() => {
    const check = async () => {
      try {
        const apiRes = await fetch("https://building-financials-backend.onrender.com/health");
        const json = await apiRes.json();
        setApiStatus(json.ok ? `API OK${json.audit_mode ? " (audit mode)" : ""}` : `API error: ${json.error}`);
      } catch (err) {
        setApiStatus(`API unreachable: ${err.message}`);
      }
    };
    check();
  }, []);

  // Session
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session ?? null);
      setAuthReady(true);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, sess) => {
      setSession(sess);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  const handleUnauthorized = useCallback(
    async (res) => {
      if (res.status !== 401) return false;
      await supabase.auth.signOut();
      setMe(null);
      setReport(null);
      addToast("Session expired. Please sign in again.", "error");
      return true;
    },
    [addToast]
  );

  const fetchMe = useCallback(async () => {
    if (!session?.access_token) {
      setMe(null);
      return;
    }
    try {
      const res = await apiFetch("/api/me");
      if (await handleUnauthorized(res)) return;
      const json = await res.json();
      if (res.ok) setMe(json);
      else setMe({ error: json.error });
    } catch (err) {
      setMe({ error: err.message });
    }
  }, [session, handleUnauthorized]);

  // Query builders with sanitization
  const contribQueryString = useMemo(() => {
    const params = new URLSearchParams({
      page: String(cPage),
      limit: String(PAGE_SIZE)
    });
    const sDate = cleanDate(cFilters.startDate);
    const eDate = cleanDate(cFilters.endDate);
    const status = cleanString(cFilters.status);
    const investorId = cleanString(cFilters.investor_id);
    if (sDate) params.set("startDate", sDate);
    if (eDate) params.set("endDate", eDate);
    if (status) params.set("status", status);
    if (investorId) params.set("investor_id", investorId);
    return params.toString();
  }, [cFilters, cPage]);

  const expenseQueryString = useMemo(() => {
    const params = new URLSearchParams({
      page: String(ePage),
      limit: String(PAGE_SIZE)
    });
    const sDate = cleanDate(eFilters.startDate);
    const eDate = cleanDate(eFilters.endDate);
    const status = cleanString(eFilters.status);
    const category = cleanString(eFilters.category);
    if (sDate) params.set("startDate", sDate);
    if (eDate) params.set("endDate", eDate);
    if (status) params.set("status", status);
    if (category) params.set("category", category);
    return params.toString();
  }, [eFilters, ePage]);

  const reportQueryString = useMemo(() => {
    const params = new URLSearchParams();
    const sDate = cleanDate(cFilters.startDate);
    const eDate = cleanDate(cFilters.endDate);
    if (sDate) params.set("startDate", sDate);
    if (eDate) params.set("endDate", eDate);
    const qs = params.toString();
    return qs ? `?${qs}` : "";
  }, [cFilters]);

  const fetchReport = useCallback(async () => {
    if (!session?.access_token) return;
    setLoadingReport(true);
    try {
      const res = await apiFetch(`/api/reports/summary${reportQueryString}`);
      if (await handleUnauthorized(res)) return;
      const json = await res.json();
      if (res.ok) {
        setReport(json);
        const options = (json.contributions_by_investor || []).map((c) => ({
          id: c.investor_id,
          name: c.investor_name || c.investor_id
        }));
        setInvestorOptions(options);
      } else {
        addToast(json.error || "Error loading report", "error");
      }
    } catch (err) {
      addToast(err.message, "error");
    } finally {
      setLoadingReport(false);
    }
  }, [session, reportQueryString, addToast, handleUnauthorized]);

  const fetchContribs = useCallback(async () => {
    if (!session?.access_token) return;
    setLoadingContribs(true);
    try {
      const res = await apiFetch(`/api/contributions?${contribQueryString}`);
      if (await handleUnauthorized(res)) return;
      const json = await res.json();
      if (res.ok) {
        setContribs(json.data || []);
        setContribTotal(json.total || 0);
      } else {
        addToast(json.error || "Error loading contributions", "error");
      }
    } catch (err) {
      addToast(err.message, "error");
    } finally {
      setLoadingContribs(false);
    }
  }, [session, contribQueryString, addToast, handleUnauthorized]);

  const fetchReceipts = useCallback(async () => {
    if (!session?.access_token) return;
    try {
      const res = await apiFetch("/api/receipts");
      if (await handleUnauthorized(res)) return;
      const json = await res.json();
      if (res.ok) setReceipts(json.data || []);
      else addToast(json.error || "Error loading receipts", "error");
    } catch (err) {
      addToast(err.message, "error");
    }
  }, [session, addToast, handleUnauthorized]);

  const fetchExpenses = useCallback(async () => {
    if (!session?.access_token) return;
    setLoadingExpenses(true);
    try {
      const res = await apiFetch(`/api/expenses?${expenseQueryString}`);
      if (await handleUnauthorized(res)) return;
      const json = await res.json();
      if (res.ok) {
        setExpenses(json.data || []);
        setExpenseTotal(json.total || 0);
      } else {
        addToast(json.error || "Error loading expenses", "error");
      }
    } catch (err) {
      addToast(err.message, "error");
    } finally {
      setLoadingExpenses(false);
    }
  }, [session, expenseQueryString, addToast, handleUnauthorized]);

  useEffect(() => {
    fetchMe();
  }, [fetchMe]);

  useEffect(() => {
    if (session?.access_token && me?.role) {
      fetchReport();
      fetchContribs();
      fetchReceipts();
      fetchExpenses();
    }
  }, [session, me, fetchReport, fetchContribs, fetchReceipts, fetchExpenses]);

  // Auth handlers
  const handleLogin = async (e) => {
    e.preventDefault();
    setAuthError("");

    if (!selectedRole) {
      setAuthError("Please select a role before signing in.");
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setAuthError(error.message);
      addToast(error.message, "error");
      return;
    }

    const res = await apiFetch("/api/me");
    if (await handleUnauthorized(res)) return;
    const json = await res.json();

    if (!res.ok) {
      await supabase.auth.signOut();
      setAuthError(json.error || "Unable to verify role.");
      return;
    }

    if (json.role !== selectedRole) {
      await supabase.auth.signOut();
      setAuthError(`Role mismatch. You selected "${selectedRole}" but your account is "${json.role}".`);
      return;
    }

    setMe(json);
    addToast("Logged in");
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setMe(null);
    setReport(null);
    setSelectedRole("");
    addToast("Logged out");
  };

  const role = me?.role;
  const isAdmin = role === "admin";
  const isDev = role === "developer";
  const isInv = role === "investor";

  const contribPages = Math.max(1, Math.ceil(contribTotal / PAGE_SIZE));
  const expensePages = Math.max(1, Math.ceil(expenseTotal / PAGE_SIZE));

  const visibleContribs = useMemo(() => contribs || [], [contribs]);
  const approvedContribs = useMemo(() => visibleContribs.filter((c) => c.status === "approved"), [visibleContribs]);

  const showLogin = authReady && (!session || !me?.role);

  if (showLogin) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center">
        <Toasts toasts={toasts} remove={removeToast} />
        <div className="w-full max-w-3xl grid gap-6 md:grid-cols-2 glass p-6 border border-white/60 shadow-xl">
          <div className="space-y-4">
            <p className="text-xs uppercase tracking-[0.3em] text-ink/60">BrickLedger Access</p>
            <h1 className="text-3xl font-bold text-ink">Secure Investor Portal</h1>
            <p className="subtle">
              Choose your role and sign in to access financials. This portal is protected for approved stakeholders only.
            </p>
            <div className="grid gap-3">
              {roleOptions.map((r) => (
                <button
                  key={r.value}
                  type="button"
                  onClick={() => setSelectedRole(r.value)}
                  className={`text-left glass border px-4 py-3 transition ${
                    selectedRole === r.value ? "border-ink shadow-md" : "border-white/50"
                  }`}
                >
                  <div className="font-semibold text-ink">{r.label}</div>
                  <div className="text-xs text-ink/70">{r.desc}</div>
                </button>
              ))}
            </div>
          </div>
          <form onSubmit={handleLogin} className="flex flex-col gap-3">
            <div className="text-sm text-ink/70">
              Selected role: <span className="font-semibold text-ink">{selectedRole || "None"}</span>
            </div>
            <input className="input" type="email" placeholder="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            <input
              className="input"
              type="password"
              placeholder="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <button className="btn-primary" type="submit" disabled={!selectedRole}>
              Sign In
            </button>
            {authError && <span className="text-sm text-red-600">{authError}</span>}
            <div className="text-xs text-ink/60">API Status: {apiStatus}</div>
          </form>
        </div>
      </div>
    );
  }

  if (!authReady) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="glass p-4">Loading session...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-10">
      <Toasts toasts={toasts} remove={removeToast} />

      {/* Header */}
      <header className="section">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.2em] text-ink/60">Investor & Project Portal</p>
            <h1 className="text-3xl font-bold text-ink">Control Center</h1>
            <p className="subtle">Investors can view/filter contributions and expenses. Developers/Admin can approve and log receipts.</p>
          </div>
          <div className="flex flex-col items-start gap-2 md:items-end w-full sm:w-auto">
            <span className="badge">{apiStatus}</span>
            <div className="glass px-4 py-3 border border-white/60 w-full sm:w-80 text-left">
              <div className="text-sm font-semibold text-ink">{me?.full_name || session.user.email}</div>
              <div className="text-xs text-ink/70 break-words">{session.user.email}</div>
              <div className="text-xs text-ink/70">Role: {me?.role || "—"}</div>
              <div className="text-xs text-ink/60">
                Last login: {me?.last_sign_in_at ? new Date(me.last_sign_in_at).toLocaleString() : "—"}
              </div>
              <button className="btn-ghost mt-2 w-full" onClick={handleLogout}>
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Tabs */}
      <div className="section flex gap-2 flex-wrap">
        {["dashboard", "contributions", "expenses", "reports"].map((t) => (
          <button key={t} className={`tab ${tab === t ? "tab-active" : ""}`} onClick={() => setTab(t)}>
            {t[0].toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>
      
      {/* Dashboard */}
      {tab === "dashboard" && (
        <section className="section">
          <h3 className="heading">Overview</h3>
          {loadingReport ? (
            <div className="skeleton h-32 w-full" />
          ) : report ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="glass p-4">
                <p className="subtle">Developer Balance</p>
                <p className="text-2xl font-bold">KES {report.balances?.balance_kes ?? "-"}</p>
              </div>
              <div className="glass p-4">
                <p className="subtle">Total Contributions (GBP)</p>
                <p className="text-2xl font-bold">£ {report.balances?.total_contributions_gbp ?? "-"}</p>
              </div>
              <div className="glass p-4">
                <p className="subtle">Total Received (KES)</p>
                <p className="text-2xl font-bold">KES {report.balances?.total_received_kes ?? "-"}</p>
              </div>
              <div className="glass p-4">
                <p className="subtle">Total Expenses (KES)</p>
                <p className="text-2xl font-bold">KES {report.balances?.total_expenses_kes ?? "-"}</p>
              </div>
            </div>
          ) : (
            <p className="subtle">No data yet.</p>
          )}
        </section>
      )}

      {/* Contributions */}
      {tab === "contributions" && (
        <section className="section space-y-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <h3 className="heading">Contributions</h3>
              <p className="subtle">Investors can filter by investor name, status, and date.</p>
            </div>
            <div className="flex gap-2 flex-wrap">
              <button
                className="btn-ghost"
                onClick={() => {
                  setCFilters({ startDate: "", endDate: "", status: "", investor_id: "" });
                  setCPage(1);
                  fetchContribs();
                }}
              >
                Clear Filters
              </button>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-5">
            <div>
              <label className="label">Start date</label>
              <input
                className="input"
                type="date"
                value={cFilters.startDate}
                onChange={(e) => setCFilters((f) => ({ ...f, startDate: e.target.value }))}
              />
            </div>
            <div>
              <label className="label">End date</label>
              <input
                className="input"
                type="date"
                value={cFilters.endDate}
                onChange={(e) => setCFilters((f) => ({ ...f, endDate: e.target.value }))}
              />
            </div>
            <div>
              <label className="label">Status</label>
              <select
                className="input"
                value={cFilters.status}
                onChange={(e) => setCFilters((f) => ({ ...f, status: e.target.value }))}
              >
                {statusOptions.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="label">Investor</label>
              <select
                className="input"
                value={cFilters.investor_id}
                onChange={(e) => setCFilters((f) => ({ ...f, investor_id: e.target.value }))}
              >
                <option value="">All investors</option>
                {investorOptions.map((inv) => (
                  <option key={inv.id} value={inv.id}>
                    {inv.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {(isInv || isAdmin) && (
            <div className="glass p-4 rounded-xl border border-white/60">
              <h4 className="text-lg font-semibold text-ink mb-2">Add Contribution (GBP)</h4>
              <form onSubmit={submitContribution} className="grid gap-3 md:grid-cols-3">
                <div className="md:col-span-1">
                  <label className="label">GBP amount</label>
                  <input
                    className="input"
                    type="number"
                    step="0.01"
                    placeholder="1000.00"
                    value={contribAmount}
                    onChange={(e) => setContribAmount(e.target.value)}
                    required
                  />
                </div>
                <div className="md:col-span-1">
                  <label className="label">Date sent</label>
                  <input
                    className="input"
                    type="date"
                    value={contribDateSent}
                    onChange={(e) => setContribDateSent(e.target.value)}
                    required
                  />
                </div>
                <div className="md:col-span-1">
                  <label className="label">Note (optional)</label>
                  <input
                    className="input"
                    type="text"
                    placeholder="Reference"
                    value={contribNote}
                    onChange={(e) => setContribNote(e.target.value)}
                  />
                </div>
                <div className="md:col-span-3">
                  <button className="btn-primary" type="submit">
                    Create Contribution
                  </button>
                </div>
              </form>
            </div>
          )}

          {loadingContribs ? (
            <div className="skeleton h-32 w-full" />
          ) : visibleContribs.length === 0 ? (
            <p className="subtle">No contributions found.</p>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {visibleContribs.map((c) => (
                <div key={c.id} className="glass p-4 border border-white/60 space-y-2">
                  <div className="flex justify-between">
                    <div>
                      <div className="font-semibold text-ink">GBP {Number(c.gbp_amount).toLocaleString()}</div>
                      <div className="text-xs text-ink/70">Created: {formatDate(c.created_at)}</div>
                      <div className="text-xs text-ink/70">Date sent: {c.date_sent || "��"}</div>
                    </div>
                    <span className="badge capitalize">{c.status}</span>
                  </div>
                  <div className="text-sm text-ink/80">Investor: {c.investor_id}</div>
                  <div className="text-sm text-ink/70 break-words">Note: {c.note || "—"}</div>

                  {(isDev || isAdmin) && c.status === "pending" && (
                    <div className="flex gap-2">
                      <button className="btn-primary w-full" onClick={() => approveContribution(c.id, "approved")}>
                        Approve
                      </button>
                      <button className="btn-ghost w-full" onClick={() => approveContribution(c.id, "rejected")}>
                        Reject
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="flex items-center gap-3">
            <button className="btn-ghost" disabled={cPage <= 1} onClick={() => setCPage((p) => Math.max(1, p - 1))}>
              Prev
            </button>
            <span className="text-sm text-ink/70">
              Page {cPage} / {contribPages}
            </span>
            <button
              className="btn-ghost"
              disabled={cPage >= contribPages}
              onClick={() => setCPage((p) => Math.min(contribPages, p + 1))}
            >
              Next
            </button>
          </div>

          {(isDev || isAdmin) && (
            <div className="glass p-4 border border-white/60 space-y-3">
              <h4 className="text-lg font-semibold text-ink">Log Receipt (select approved contribution)</h4>
              <form onSubmit={logReceipt} className="grid gap-3 md:grid-cols-3">
                <div className="md:col-span-2">
                  <label className="label">Contribution</label>
                  <select
                    className="input"
                    value={selectedContribution}
                    onChange={(e) => setSelectedContribution(e.target.value)}
                    required
                  >
                    <option value="">Select approved contribution</option>
                    {approvedContribs.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.id} — GBP {c.gbp_amount} — {c.note || "no note"}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label">KES received</label>
                  <input
                    className="input"
                    type="number"
                    step="0.01"
                    value={receiptKes}
                    onChange={(e) => setReceiptKes(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className="label">FX rate (optional)</label>
                  <input
                    className="input"
                    type="number"
                    step="0.000001"
                    value={receiptFx}
                    onChange={(e) => setReceiptFx(e.target.value)}
                  />
                </div>
                <div className="md:col-span-3">
                  <button className="btn-primary" type="submit">
                    Log Receipt
                  </button>
                </div>
              </form>
            </div>
          )}
        </section>
      )}

      {/* Expenses */}
      {tab === "expenses" && (
        <section className="section space-y-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <h3 className="heading">Expenses</h3>
              <p className="subtle">Investors can view, flag, and comment. Filters and pagination included.</p>
            </div>
            <button
              className="btn-ghost"
              onClick={() => {
                setEFilters({ startDate: "", endDate: "", status: "", category: "" });
                setEPage(1);
                fetchExpenses();
              }}
            >
              Clear Filters
            </button>
          </div>

          <div className="grid gap-3 md:grid-cols-4">
            <div>
              <label className="label">Start date</label>
              <input
                className="input"
                type="date"
                value={eFilters.startDate}
                onChange={(e) => setEFilters((f) => ({ ...f, startDate: e.target.value }))}
              />
            </div>
            <div>
              <label className="label">End date</label>
              <input
                className="input"
                type="date"
                value={eFilters.endDate}
                onChange={(e) => setEFilters((f) => ({ ...f, endDate: e.target.value }))}
              />
            </div>
            <div>
              <label className="label">Category</label>
              <select
                className="input"
                value={eFilters.category}
                onChange={(e) => setEFilters((f) => ({ ...f, category: e.target.value }))}
              >
                <option value="">Any</option>
                <option value="materials">materials</option>
                <option value="labour">labour</option>
                <option value="other">other</option>
              </select>
            </div>
            <div>
              <label className="label">Status</label>
              <select
                className="input"
                value={eFilters.status}
                onChange={(e) => setEFilters((f) => ({ ...f, status: e.target.value }))}
              >
                <option value="">Any</option>
                <option value="flagged">Flagged</option>
                <option value="unflagged">Unflagged</option>
              </select>
            </div>
          </div>

          {loadingExpenses ? (
            <div className="skeleton h-32 w-full" />
          ) : expenses.length === 0 ? (
            <p className="subtle">No expenses found.</p>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {expenses.map((ex) => (
                <div
                  key={ex.id}
                  className={`glass p-4 border ${selectedExpense === ex.id ? "border-ink" : "border-white/60"} space-y-2 cursor-pointer`}
                  onClick={() => setSelectedExpense(ex.id)}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="font-semibold text-ink">KES {Number(ex.amount_kes).toLocaleString()}</div>
                      <div className="text-xs text-ink/70">Date: {ex.expense_date}</div>
                      <div className="text-xs text-ink/70 capitalize">Category: {ex.category}</div>
                    </div>
                    {ex.flagged && <span className="badge">Flagged</span>}
                  </div>
                  <div className="text-sm text-ink/80">{ex.description || "—"}</div>
                  {ex.receipt_url && (
                    <a className="text-xs text-ink underline" href={ex.receipt_url} target="_blank" rel="noreferrer">
                      Receipt
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="flex items-center gap-3">
            <button className="btn-ghost" disabled={ePage <= 1} onClick={() => setEPage((p) => Math.max(1, p - 1))}>
              Prev
            </button>
            <span className="text-sm text-ink/70">
              Page {ePage} / {expensePages}
            </span>
            <button
              className="btn-ghost"
              disabled={ePage >= expensePages}
              onClick={() => setEPage((p) => Math.min(expensePages, p + 1))}
            >
              Next
            </button>
          </div>

          {isInv || isAdmin ? (
            <div className="glass p-4 border border-white/60 space-y-3">
              <div className="text-sm text-ink/80">
                Selected expense: {selectedExpense || "None"} (click a card above to select)
              </div>
              <div className="flex flex-col md:flex-row gap-3">
                <button className="btn-primary w-full md:w-auto" onClick={flagExpense} disabled={!selectedExpense}>
                  Flag Expense
                </button>
                <div className="flex flex-col gap-2 w-full md:w-auto flex-1">
                  <textarea
                    className="input h-20"
                    placeholder="Add a comment"
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                  />
                  <button className="btn-ghost w-full md:w-auto" onClick={commentExpense} disabled={!selectedExpense}>
                    Add Comment
                  </button>
                </div>
              </div>
            </div>
          ) : null}
        </section>
      )}

      {/* Reports */}
      {tab === "reports" && (
        <section className="section">
          <h3 className="heading">Reports</h3>
          {loadingReport ? (
            <div className="skeleton h-32 w-full" />
          ) : report ? (
            <div className="space-y-3 text-sm">
              <div className="glass p-3">
                <div className="font-semibold">Balances</div>
                <div>Total Received (KES): {report.balances?.total_received_kes ?? "-"}</div>
                <div>Total Contributions (GBP): {report.balances?.total_contributions_gbp ?? "-"}</div>
                <div>Total Expenses (KES): {report.balances?.total_expenses_kes ?? "-"}</div>
                <div>Balance (KES): {report.balances?.balance_kes ?? "-"}</div>
              </div>
              <div className="glass p-3">
                <div className="font-semibold">Contributions by Investor</div>
                <ul className="list-disc list-inside">
                  {(report.contributions_by_investor || []).map((c) => (
                    <li key={c.investor_id}>{c.investor_name || c.investor_id} — GBP {c.total_gbp}</li>
                  ))}
                </ul>
              </div>
              <div className="glass p-3">
                <div className="font-semibold">Expenses by Category</div>
                <ul className="list-disc list-inside">
                  {(report.expenses_by_category || []).map((e, i) => (
                    <li key={i}>{e.category}: KES {e.total_kes}</li>
                  ))}
                </ul>
              </div>
              <div className="glass p-3">
                <div className="font-semibold">Monthly Cashflow</div>
                <ul className="list-disc list-inside">
                  {(report.monthly_cashflow || []).map((m, i) => (
                    <li key={i}>
                      {m.month}: inflow {m.inflow_kes}, outflow {m.outflow_kes}, net {m.net_kes}
                    </li>
                  ))}
                </ul>
              </div>
              {isAdmin && (
                <div className="flex gap-3 flex-wrap">
                  <button className="btn-primary" type="button" onClick={() => downloadFile("/api/export/pdf", "financials.pdf", "application/pdf")}>
                    Download PDF
                  </button>
                  <button
                    className="btn-primary"
                    type="button"
                    onClick={() =>
                      downloadFile(
                        "/api/export/excel",
                        "financials.xlsx",
                        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                      )
                    }
                  >
                    Download Excel
                  </button>
                </div>
              )}
            </div>
          ) : (
            <p className="subtle">No report data yet.</p>
          )}
        </section>
      )}
    </div>
  );
}