"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "../lib/supabaseClient";

// Lightweight API client with silent refresh
async function getValidSession() {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  if (data.session) return data.session;
  // try refresh
  const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession();
  if (refreshError) throw refreshError;
  return refreshed.session ?? null;
}

async function apiFetch(path, { method = "GET", body, signal } = {}) {
  const session = await getValidSession();
  const headers = { "Content-Type": "application/json" };
  if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`;
  const res = await fetch(path, { method, headers, body: body ? JSON.stringify(body) : undefined, signal });
  if (res.status === 401 || res.status === 403) throw new Error("Unauthorized");
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || "Request failed");
  return json;
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

function SessionCard({ me, onLogout }) {
  return (
    <div className="glass p-4 flex flex-col gap-2">
      <div className="text-lg font-semibold text-ink">Logged in as: {me?.full_name || me?.email}</div>
      <div className="text-sm text-ink/80">Role: {me?.role}</div>
      <div className="text-sm text-ink/80 break-words">Email: {me?.email}</div>
      <button className="btn-ghost w-full sm:w-auto" onClick={onLogout}>Logout</button>
    </div>
  );
}

function Pagination({ page, total, limit, onPage }) {
  const totalPages = Math.max(1, Math.ceil((total || 0) / limit));
  return (
    <div className="flex items-center gap-2 text-sm">
      <button className="btn-ghost" disabled={page <= 1} onClick={() => onPage(page - 1)}>Prev</button>
      <span>Page {page} / {totalPages}</span>
      <button className="btn-ghost" disabled={page >= totalPages} onClick={() => onPage(page + 1)}>Next</button>
    </div>
  );
}

function ExpenseCard({ item, onFlag, onComment, onViewReceipt }) {
  return (
    <div className="glass p-4 flex flex-col gap-2">
      <div className="flex justify-between items-center">
        <div className="text-lg font-semibold text-ink">KES {Number(item.amount_kes).toLocaleString()}</div>
        <span className="badge capitalize">{item.category}</span>
      </div>
      <div className="text-sm text-ink/80">{item.expense_date}</div>
      <div className="text-sm text-ink">{item.description || "No description"}</div>
      <div className="flex gap-2 flex-wrap">
        {item.receipt_url && (
          <button className="btn-ghost" type="button" onClick={() => onViewReceipt(item.id)}>View Receipt</button>
        )}
        <button className="btn-primary" type="button" onClick={() => onComment(item.id)}>Comment</button>
        <button className="btn-ghost" type="button" onClick={() => onFlag(item.id)}>Flag</button>
      </div>
    </div>
  );
}

export default function Home() {
  const apiBase = process.env.NEXT_PUBLIC_API_BASE || "https://building-financials-backend.onrender.com";
  const { toasts, add: addToast, remove: removeToast } = useToasts();

  const [apiStatus, setApiStatus] = useState("Checking...");
  const [session, setSession] = useState(null);
  const [me, setMe] = useState(null);
  const [authError, setAuthError] = useState("");

  // Auth form
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // Forms state (GBP)
  const [contribAmount, setContribAmount] = useState("");
  const [contribNote, setContribNote] = useState("");
  const [contribDate, setContribDate] = useState("");

  const [receiptContributionId, setReceiptContributionId] = useState("");
  const [receiptKes, setReceiptKes] = useState("");
  const [receiptFx, setReceiptFx] = useState("");

  const [expenseAmount, setExpenseAmount] = useState("");
  const [expenseCategory, setExpenseCategory] = useState("materials");
  const [expenseDate, setExpenseDate] = useState("");
  const [expenseDesc, setExpenseDesc] = useState("");
  const [expenseReceiptUrl, setExpenseReceiptUrl] = useState("");

  const [approveReceiptId, setApproveReceiptId] = useState("");
  const [flagExpenseId, setFlagExpenseId] = useState("");
  const [commentExpenseId, setCommentExpenseId] = useState("");
  const [commentText, setCommentText] = useState("");
  const [uploadFile, setUploadFile] = useState(null);

  // Lists + pagination/filter state
  const [contribs, setContribs] = useState([]);
  const [receipts, setReceipts] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [report, setReport] = useState(null);

  const [contribTotal, setContribTotal] = useState(0);
  const [receiptTotal, setReceiptTotal] = useState(0);
  const [expenseTotal, setExpenseTotal] = useState(0);
  const [contribPage, setContribPage] = useState(1);
  const [receiptPage, setReceiptPage] = useState(1);
  const [expensePage, setExpensePage] = useState(1);
  const limit = 10;

  // Filters
  const [filterStart, setFilterStart] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 30); return d.toISOString().slice(0,10);
  });
  const [filterEnd, setFilterEnd] = useState(() => new Date().toISOString().slice(0,10));
  const [filterStatus, setFilterStatus] = useState("");
  const [filterCategory, setFilterCategory] = useState("");

  const authHeaders = async () => {
    const s = await getValidSession();
    const headers = { "Content-Type": "application/json" };
    if (s?.access_token) headers.Authorization = `Bearer ${s.access_token}`;
    return headers;
  };

  // Health
  useEffect(() => {
    const check = async () => {
      try {
        const res = await fetch(`${apiBase}/health`);
        const json = await res.json();
        setApiStatus(json.ok ? `API OK${json.audit_mode ? " (audit mode)" : ""}` : `API error: ${json.error}`);
      } catch (err) {
        setApiStatus(`API unreachable: ${err.message}`);
      }
    };
    check();
  }, [apiBase]);

  // Session
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session ?? null));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, sess) => setSession(sess));
    return () => listener.subscription.unsubscribe();
  }, []);

  const fetchMe = useCallback(async () => {
    if (!session?.access_token) {
      setMe(null);
      return;
    }
    try {
      const headers = await authHeaders();
      const res = await fetch(`${apiBase}/api/me`, { headers });
      const json = await res.json();
      if (res.ok) setMe(json);
      else setMe({ error: json.error });
    } catch (err) {
      setMe({ error: err.message });
    }
  }, [apiBase, session]);

  const fetchLists = useCallback(async () => {
    if (!session?.access_token) return;
    try {
      const headers = await authHeaders();

      const contribRes = await fetch(`${apiBase}/api/contributions?page=${contribPage}&limit=${limit}&startDate=${filterStart}&endDate=${filterEnd}&status=${filterStatus}`, { headers });
      const contribJson = await contribRes.json();
      if (contribRes.ok) {
        setContribs(contribJson.data || []);
        setContribTotal(contribJson.total || 0);
      } else addToast(contribJson.error || "Error loading contributions", "error");

      const receiptRes = await fetch(`${apiBase}/api/receipts?page=${receiptPage}&limit=${limit}&startDate=${filterStart}&endDate=${filterEnd}&status=${filterStatus}`, { headers });
      const receiptJson = await receiptRes.json();
      if (receiptRes.ok) {
        setReceipts(receiptJson.data || []);
        setReceiptTotal(receiptJson.total || 0);
      } else addToast(receiptJson.error || "Error loading receipts", "error");

      const expenseRes = await fetch(`${apiBase}/api/expenses?page=${expensePage}&limit=${limit}&startDate=${filterStart}&endDate=${filterEnd}&category=${filterCategory}&status=${filterStatus}`, { headers });
      const expenseJson = await expenseRes.json();
      if (expenseRes.ok) {
        setExpenses(expenseJson.data || []);
        setExpenseTotal(expenseJson.total || 0);
      } else addToast(expenseJson.error || "Error loading expenses", "error");
    } catch (err) {
      addToast(err.message, "error");
    }
  }, [apiBase, session, contribPage, receiptPage, expensePage, filterStart, filterEnd, filterStatus, filterCategory, addToast]);

  const fetchReport = useCallback(async () => {
    if (!session?.access_token) return;
    try {
      const headers = await authHeaders();
      const res = await fetch(`${apiBase}/api/reports/summary?startDate=${filterStart}&endDate=${filterEnd}`, { headers });
      const json = await res.json();
      if (res.ok) setReport(json);
    } catch (err) {
      addToast(err.message, "error");
    }
  }, [apiBase, session, filterStart, filterEnd, addToast]);

  useEffect(() => {
    fetchMe();
  }, [fetchMe]);

  useEffect(() => {
    fetchLists();
    fetchReport();
  }, [fetchLists, fetchReport]);

  // Realtime refresh
  useEffect(() => {
    if (!session?.access_token) return;
    const channel = supabase
      .channel("realtime:receipts_expenses")
      .on("postgres_changes", { event: "*", schema: "public", table: "receipts" }, () => {
        fetchLists();
        fetchReport();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "expenses" }, () => {
        fetchLists();
        fetchReport();
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [session, fetchLists, fetchReport]);

  // Auth
  const handleLogin = async (e) => {
    e.preventDefault();
    setAuthError("");
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setAuthError(error.message);
      addToast(error.message, "error");
    } else {
      addToast("Logged in");
    }
  };
  const handleLogout = async () => {
    await supabase.auth.signOut();
    setMe(null);
    setReport(null);
    addToast("Logged out");
  };

  // Investor: contribution (GBP)
  const submitContribution = async (e) => {
    e.preventDefault();
    try {
      await apiFetch(`${apiBase}/api/contributions`, {
        method: "POST",
        body: { gbp_amount: Number(contribAmount), note: contribNote, date_sent: contribDate }
      });
      addToast("Contribution created");
      setContribAmount("");
      setContribNote("");
      setContribDate("");
      fetchLists();
      fetchReport();
    } catch (err) {
      addToast(err.message, "error");
    }
  };

  // Developer: receipt
  const submitReceipt = async (e) => {
    e.preventDefault();
    try {
      await apiFetch(`${apiBase}/api/receipts`, {
        method: "POST",
        body: {
          contribution_id: receiptContributionId,
          kes_received: Number(receiptKes),
          fx_rate: receiptFx ? Number(receiptFx) : null
        }
      });
      addToast("Receipt logged");
      setReceiptContributionId("");
      setReceiptKes("");
      setReceiptFx("");
      fetchLists();
      fetchReport();
    } catch (err) {
      addToast(err.message, "error");
    }
  };

  // Developer: expense
  const submitExpense = async (e) => {
    e.preventDefault();
    try {
      await apiFetch(`${apiBase}/api/expenses`, {
        method: "POST",
        body: {
          amount_kes: Number(expenseAmount),
          category: expenseCategory,
          expense_date: expenseDate,
          description: expenseDesc,
          receipt_url: expenseReceiptUrl || null
        }
      });
      addToast("Expense logged");
      setExpenseAmount("");
      setExpenseCategory("materials");
      setExpenseDate("");
      setExpenseDesc("");
      setExpenseReceiptUrl("");
      fetchLists();
      fetchReport();
    } catch (err) {
      addToast(err.message, "error");
    }
  };

  // Admin: approve receipt
  const submitApproveReceipt = async (e) => {
    e.preventDefault();
    try {
      await apiFetch(`${apiBase}/api/admin/receipts/${approveReceiptId}/approve`, { method: "POST" });
      addToast("Receipt approved");
      setApproveReceiptId("");
      fetchLists();
      fetchReport();
    } catch (err) {
      addToast(err.message, "error");
    }
  };

  // Flag/comment
  const submitFlag = async (expenseId) => {
    try {
      await apiFetch(`${apiBase}/api/expenses/${expenseId}/flag`, { method: "POST", body: { flagged: true } });
      addToast("Expense flagged");
      fetchLists();
      fetchReport();
    } catch (err) {
      addToast(err.message, "error");
    }
  };

  const submitComment = async (expenseId, text) => {
    try {
      await apiFetch(`${apiBase}/api/expenses/${expenseId}/comments`, { method: "POST", body: { comment: text } });
      addToast("Comment added");
    } catch (err) {
      addToast(err.message, "error");
    }
  };

  // Upload receipt
  const submitUpload = async (e) => {
    e.preventDefault();
    if (!uploadFile) {
      addToast("Select a file", "error");
      return;
    }
    try {
      const s = await getValidSession();
      const headers = s?.access_token ? { Authorization: `Bearer ${s.access_token}` } : {};
      const formData = new FormData();
      formData.append("file", uploadFile);
      const res = await fetch(`${apiBase}/api/uploads/receipt`, { method: "POST", headers, body: formData });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Upload failed");
      addToast("Uploaded");
      setUploadFile(null);
    } catch (err) {
      addToast(err.message, "error");
    }
  };

  // Signed receipt view
  const viewReceipt = async (expenseId) => {
    try {
      const headers = await authHeaders();
      const res = await fetch(`${apiBase}/api/expenses/${expenseId}/receipt-url`, { headers });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to fetch receipt");
      window.open(json.url, "_blank", "noopener,noreferrer");
    } catch (err) {
      addToast(err.message, "error");
    }
  };

  const role = me?.role;

  // Primary actions for sticky bar
  const primaryActions = [];
  if (role === "investor" || role === "admin") {
    primaryActions.push({ label: "Add Contribution", onClick: () => document.getElementById("contrib-form")?.scrollIntoView({ behavior: "smooth" }) });
  }
  if (role === "developer" || role === "admin") {
    primaryActions.push({ label: "Log Expense", onClick: () => document.getElementById("expense-form")?.scrollIntoView({ behavior: "smooth" }) });
  }
  if (role === "admin") {
    primaryActions.push({ label: "Approve Receipt", onClick: () => document.getElementById("approve-form")?.scrollIntoView({ behavior: "smooth" }) });
  }

  return (
    <div className="space-y-6 pb-24">
      <Toasts toasts={toasts} remove={removeToast} />

      {/* Header */}
      <header className="section">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="text-center md:text-left w-full">
            <h1 className="text-3xl font-bold text-ink">BrickLedger</h1>
            <p className="subtle">Enabling smart & transparent investing back at home</p>
          </div>
          <div className="flex flex-col items-start gap-2 md:items-end w-full sm:w-auto">
            <span className="badge">{apiStatus}</span>
            {session && me ? (
              <SessionCard me={me} onLogout={handleLogout} />
            ) : (
              <form onSubmit={handleLogin} className="glass p-4 w-full sm:w-80 flex flex-col gap-2 border border-white/50">
                <h3 className="text-lg font-semibold text-ink">Sign In</h3>
                <input className="input" type="email" placeholder="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
                <input className="input" type="password" placeholder="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
                <button className="btn-primary" type="submit">Sign In</button>
                {authError && <span className="text-sm text-red-600">{authError}</span>}
                <p className="text-xs text-ink/60">
                  Forgot password? <a className="text-ink underline" href="/auth/reset">Reset here</a>
                </p>
              </form>
            )}
          </div>
        </div>
      </header>

      {/* Filters */}
      <section className="section">
        <h2 className="heading">Filters (last 30 days default)</h2>
        <div className="grid gap-3 md:grid-cols-4">
          <div>
            <label className="label">Start date</label>
            <input className="input" type="date" value={filterStart} onChange={(e) => setFilterStart(e.target.value)} />
          </div>
          <div>
            <label className="label">End date</label>
            <input className="input" type="date" value={filterEnd} onChange={(e) => setFilterEnd(e.target.value)} />
          </div>
          <div>
            <label className="label">Status</label>
            <select className="input" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
              <option value="">All</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="flagged">Flagged</option>
              <option value="clean">Not flagged</option>
            </select>
          </div>
          <div>
            <label className="label">Category</label>
            <select className="input" value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)}>
              <option value="">All</option>
              <option value="materials">materials</option>
              <option value="labour">labour</option>
              <option value="other">other</option>
            </select>
          </div>
        </div>
        <div className="mt-3 flex gap-2">
          <button className="btn-primary" onClick={() => { setContribPage(1); setReceiptPage(1); setExpensePage(1); fetchLists(); fetchReport(); }}>Apply</button>
        </div>
      </section>

      {/* Reports */}
      <section className="section">
        <h2 className="heading">Reports</h2>
        {report ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 text-sm">
            <div className="glass p-3">
              <div className="font-semibold">Developer Balance</div>
              <div>{report.balances?.balance_kes ?? "-"}</div>
            </div>
            <div className="glass p-3">
              <div className="font-semibold">Total Contributions (GBP)</div>
              <div>
                {(report.contributions_by_investor || []).reduce((sum, c) => sum + Number(c.total_gbp || 0), 0).toLocaleString()}
              </div>
            </div>
            <div className="glass p-3">
              <div className="font-semibold">Total Expenses (KES)</div>
              <div>{report.balances?.total_expenses_kes ?? "-"}</div>
            </div>
            <div className="glass p-3">
              <div className="font-semibold">Monthly Cashflow (latest)</div>
              <div>
                {report.monthly_cashflow?.[0]
                  ? `${report.monthly_cashflow[0].month}: net ${report.monthly_cashflow[0].net_kes}`
                  : "—"}
              </div>
            </div>
          </div>
        ) : (
          <p className="subtle">No report data yet.</p>
        )}
        {role === "admin" && (
          <div className="mt-3 flex gap-3 flex-wrap">
            <button className="btn-primary" type="button" onClick={() => downloadFile("/api/export/pdf", "brickledger_financials.pdf", "application/pdf")}>
              Download PDF
            </button>
            <button className="btn-primary" type="button" onClick={() => downloadFile("/api/export/excel", "brickledger_financials.xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")}>
              Download Excel
            </button>
          </div>
        )}
      </section>

      {/* Contributions list */}
      <section className="section">
        <div className="flex items-center justify-between">
          <h3 className="heading">Contributions</h3>
          <Pagination page={contribPage} limit={limit} total={contribTotal} onPage={setContribPage} />
        </div>
        <pre className="bg-white/80 rounded-xl p-3 border border-white/60 text-xs max-h-64 overflow-auto">
{JSON.stringify(contribs, null, 2)}
        </pre>
      </section>

      {/* Receipts list */}
      <section className="section">
        <div className="flex items-center justify-between">
          <h3 className="heading">Receipts</h3>
          <Pagination page={receiptPage} limit={limit} total={receiptTotal} onPage={setReceiptPage} />
        </div>
        <pre className="bg-white/80 rounded-xl p-3 border border-white/60 text-xs max-h-64 overflow-auto">
{JSON.stringify(receipts, null, 2)}
        </pre>
      </section>

      {/* Expenses cards */}
      <section className="section">
        <div className="flex items-center justify-between">
          <h3 className="heading">Expenses</h3>
          <Pagination page={expensePage} limit={limit} total={expenseTotal} onPage={setExpensePage} />
        </div>
        <div className="grid gap-3">
          {expenses.map((ex) => (
            <ExpenseCard
              key={ex.id}
              item={ex}
              onFlag={() => submitFlag(ex.id)}
              onComment={() => {
                const text = prompt("Add comment");
                if (text) submitComment(ex.id, text);
              }}
              onViewReceipt={() => viewReceipt(ex.id)}
            />
          ))}
          {expenses.length === 0 && <p className="subtle">No expenses.</p>}
        </div>
      </section>

      {/* Forms */}
      <div className="grid gap-6 lg:grid-cols-2">
        {(role === "investor" || role === "admin") && (
          <section className="section" id="contrib-form">
            <h3 className="heading">Investor: Create Contribution (GBP)</h3>
            <form onSubmit={submitContribution} className="space-y-3">
              <div>
                <label className="label">GBP amount</label>
                <input className="input" type="number" step="0.01" placeholder="1000.00" value={contribAmount} onChange={(e) => setContribAmount(e.target.value)} required />
              </div>
              <div>
                <label className="label">Date sent</label>
                <input className="input" type="date" value={contribDate} onChange={(e) => setContribDate(e.target.value)} />
              </div>
              <div>
                <label className="label">Note (optional)</label>
                <textarea className="input h-24" placeholder="Description or reference" value={contribNote} onChange={(e) => setContribNote(e.target.value)} />
              </div>
              <button className="btn-primary" type="submit">Create Contribution</button>
            </form>
          </section>
        )}

        {(role === "developer" || role === "admin") && (
          <section className="section">
            <h3 className="heading">Developer: Confirm Receipt (KES)</h3>
            <form onSubmit={submitReceipt} className="space-y-3">
              <div>
                <label className="label">Contribution ID</label>
                <input className="input" type="text" placeholder="uuid" value={receiptContributionId} onChange={(e) => setReceiptContributionId(e.target.value)} required />
              </div>
              <div>
                <label className="label">KES received</label>
                <input className="input" type="number" step="0.01" placeholder="100000" value={receiptKes} onChange={(e) => setReceiptKes(e.target.value)} required />
              </div>
              <div>
                <label className="label">FX rate (optional)</label>
                <input className="input" type="number" step="0.000001" placeholder="160.123456" value={receiptFx} onChange={(e) => setReceiptFx(e.target.value)} />
              </div>
              <button className="btn-primary" type="submit">Log Receipt</button>
            </form>
          </section>
        )}
      </div>

      {(role === "developer" || role === "admin") && (
        <section className="section" id="expense-form">
          <h3 className="heading">Developer: Log Expense</h3>
          <form onSubmit={submitExpense} className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="label">Amount (KES)</label>
              <input className="input" type="number" step="0.01" placeholder="5000" value={expenseAmount} onChange={(e) => setExpenseAmount(e.target.value)} required />
            </div>
            <div>
              <label className="label">Category</label>
              <select className="input" value={expenseCategory} onChange={(e) => setExpenseCategory(e.target.value)}>
                <option value="materials">materials</option>
                <option value="labour">labour</option>
                <option value="other">other</option>
              </select>
            </div>
            <div>
              <label className="label">Expense date</label>
              <input className="input" type="date" value={expenseDate} onChange={(e) => setExpenseDate(e.target.value)} required />
            </div>
            <div>
              <label className="label">Receipt URL (optional)</label>
              <input className="input" type="url" placeholder="https://..." value={expenseReceiptUrl} onChange={(e) => setExpenseReceiptUrl(e.target.value)} />
            </div>
            <div className="md:col-span-2">
              <label className="label">Description</label>
              <textarea className="input h-24" placeholder="What was this expense for?" value={expenseDesc} onChange={(e) => setExpenseDesc(e.target.value)} />
            </div>
            <div className="md:col-span-2 flex items-center gap-3 flex-wrap">
              <button className="btn-primary" type="submit">Log Expense</button>
            </div>
          </form>
        </section>
      )}

      {(role === "developer" || role === "admin") && (
        <section className="section">
          <h3 className="heading">Developer: Upload Receipt</h3>
          <form onSubmit={submitUpload} className="flex flex-col gap-3 max-w-md">
            <input type="file" accept=".pdf,.png,.jpg,.jpeg,.webp" onChange={(e) => setUploadFile(e.target.files?.[0] || null)} className="input" />
            <button className="btn-primary" type="submit">Upload</button>
          </form>
        </section>
      )}

      {role === "admin" && (
        <section className="section" id="approve-form">
          <h3 className="heading">Admin: Approve Receipt</h3>
          <form onSubmit={submitApproveReceipt} className="flex flex-col gap-3 max-w-md">
            <input className="input" type="text" placeholder="receipt_id" value={approveReceiptId} onChange={(e) => setApproveReceiptId(e.target.value)} required />
            <button className="btn-primary" type="submit">Approve Receipt</button>
          </form>
        </section>
      )}

      {role === "admin" && (
        <section className="section">
          <h3 className="heading">Admin: Lock / Soft-delete</h3>
          <p className="subtle mb-2">Table: contributions | receipts | expenses | expense_comments</p>
          <AdminLockDeleteForm apiBase={apiBase} session={session} toast={addToast} />
        </section>
      )}

      {/* Sticky action bar (mobile-first) */}
      {primaryActions.length > 0 && (
        <div className="sticky-bar">
          <div className="sticky-bar-inner">
            {primaryActions.map((a, idx) => (
              <button key={idx} className="btn-primary w-full" type="button" onClick={a.onClick}>
                {a.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}