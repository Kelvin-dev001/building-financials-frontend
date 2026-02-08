"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { supabase } from "./lib/supabaseClient";
import { apiFetch } from "./lib/apiClient";

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

function Badge({ children, tone = "default" }) {
  const map = {
    default: "badge",
    flagged: "badge badge-flagged",
    pending: "badge badge-pending",
    approved: "badge badge-approved",
    locked: "badge badge-locked"
  };
  return <span className={map[tone] || map.default}>{children}</span>;
}

function Pagination({ page, total, limit, onPage }) {
  const pages = Math.max(1, Math.ceil((total || 0) / limit));
  return (
    <div className="flex items-center gap-2 text-sm">
      <button className="btn-ghost" type="button" disabled={page <= 1} onClick={() => onPage(page - 1)}>
        Prev
      </button>
      <span>Page {page} / {pages}</span>
      <button className="btn-ghost" type="button" disabled={page >= pages} onClick={() => onPage(page + 1)}>
        Next
      </button>
    </div>
  );
}

function Filters({ filters, setFilters, includeStatus, includeCategory }) {
  return (
    <div className="flex flex-wrap gap-2">
      <input
        className="input w-40"
        type="date"
        value={filters.startDate || ""}
        onChange={(e) => setFilters((f) => ({ ...f, startDate: e.target.value }))}
        placeholder="Start"
      />
      <input
        className="input w-40"
        type="date"
        value={filters.endDate || ""}
        onChange={(e) => setFilters((f) => ({ ...f, endDate: e.target.value }))}
        placeholder="End"
      />
      {includeStatus && (
        <select
          className="input w-40"
          value={filters.status || ""}
          onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value || undefined }))}
        >
          <option value="">Any status</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="confirmed">Confirmed</option>
        </select>
      )}
      {includeCategory && (
        <select
          className="input w-40"
          value={filters.category || ""}
          onChange={(e) => setFilters((f) => ({ ...f, category: e.target.value || undefined }))}
        >
          <option value="">Any category</option>
          <option value="materials">materials</option>
          <option value="labour">labour</option>
          <option value="other">other</option>
        </select>
      )}
    </div>
  );
}

function Modal({ open, onClose, title, children }) {
  if (!open) return null;
  return (
    <div className="modal-backdrop">
      <div className="modal">
        <div className="flex justify-between items-start gap-2 mb-4">
          <h3 className="text-lg font-semibold text-ink">{title}</h3>
          <button className="text-ink/60 font-bold" onClick={onClose}>×</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function ExpenseCard({ expense, onFlag, onComment, onViewReceipt }) {
  return (
    <div className="expense-card">
      <div className="flex items-center justify-between">
        <div className="text-lg font-semibold text-ink">KES {expense.amount_kes}</div>
        <div className="flex gap-2">
          {expense.flagged && <Badge tone="flagged">Flagged</Badge>}
          {expense.locked && <Badge tone="locked">Locked</Badge>}
        </div>
      </div>
      <div className="text-sm text-ink/80">{expense.category} • {expense.expense_date}</div>
      {expense.description && <div className="text-sm text-ink">{expense.description}</div>}
      {expense.receipt_url && (
        <button className="btn-secondary" type="button" onClick={() => onViewReceipt(expense.receipt_url)}>
          View receipt
        </button>
      )}
      <div className="flex gap-2">
        <button className="btn-primary" type="button" onClick={() => onComment(expense.id)}>Comment</button>
        <button className="btn-ghost" type="button" onClick={() => onFlag(expense.id)}>Flag</button>
      </div>
    </div>
  );
}

export default function Home() {
  const { toasts, add: addToast, remove: removeToast } = useToasts();

  const [apiStatus, setApiStatus] = useState("Checking...");
  const [session, setSession] = useState(null);
  const [me, setMe] = useState(null);
  const [authError, setAuthError] = useState("");
  const [tab, setTab] = useState("dashboard");

  // Auth form
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // Forms
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

  // Lists & pagination
  const [contribs, setContribs] = useState([]);
  const [receipts, setReceipts] = useState([]);
  const [expenses, setExpenses] = useState([]);

  const [contribPage, setContribPage] = useState(1);
  const [receiptPage, setReceiptPage] = useState(1);
  const [expensePage, setExpensePage] = useState(1);

  const [contribTotal, setContribTotal] = useState(0);
  const [receiptTotal, setReceiptTotal] = useState(0);
  const [expenseTotal, setExpenseTotal] = useState(0);

  const [filtersContrib, setFiltersContrib] = useState({ startDate: "", endDate: "", status: "" });
  const [filtersReceipt, setFiltersReceipt] = useState({ startDate: "", endDate: "", status: "" });
  const [filtersExpense, setFiltersExpense] = useState({ startDate: "", endDate: "", category: "" });

  // Reports
  const [report, setReport] = useState(null);
  const [reportFilters, setReportFilters] = useState(() => {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - 30);
    return { startDate: start.toISOString().slice(0, 10), endDate: end.toISOString().slice(0, 10) };
  });

  const role = me?.role;

  // Health
  useEffect(() => {
    const check = async () => {
      try {
        const res = await fetch("/api/ping"); // fallback local
        if (res.ok) {
          setApiStatus("API OK");
          return;
        }
      } catch (_) {}
      try {
        const res = await fetch("https://building-financials-backend.onrender.com/health");
        const json = await res.json();
        setApiStatus(json.ok ? `API OK${json.audit_mode ? " (audit mode)" : ""}` : `API error: ${json.error}`);
      } catch (err) {
        setApiStatus(`API unreachable: ${err.message}`);
      }
    };
    check();
  }, []);

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
      const res = await apiFetch("/api/me");
      const json = await res.json();
      if (res.ok) setMe(json);
      else setMe({ error: json.error });
    } catch (err) {
      setMe({ error: err.message });
    }
  }, [session]);

  const fetchContribs = useCallback(async () => {
    if (!session?.access_token) return;
    const params = new URLSearchParams({
      page: String(contribPage),
      limit: "10",
      ...(filtersContrib.startDate ? { startDate: filtersContrib.startDate } : {}),
      ...(filtersContrib.endDate ? { endDate: filtersContrib.endDate } : {}),
      ...(filtersContrib.status ? { status: filtersContrib.status } : {})
    }).toString();
    const res = await apiFetch(`/api/contributions?${params}`);
    const json = await res.json();
    if (res.ok) {
      setContribs(json.data || []);
      setContribTotal(json.total || 0);
    }
  }, [session, contribPage, filtersContrib]);

  const fetchReceipts = useCallback(async () => {
    if (!session?.access_token) return;
    const params = new URLSearchParams({
      page: String(receiptPage),
      limit: "10",
      ...(filtersReceipt.startDate ? { startDate: filtersReceipt.startDate } : {}),
      ...(filtersReceipt.endDate ? { endDate: filtersReceipt.endDate } : {}),
      ...(filtersReceipt.status ? { status: filtersReceipt.status } : {})
    }).toString();
    const res = await apiFetch(`/api/receipts?${params}`);
    const json = await res.json();
    if (res.ok) {
      setReceipts(json.data || []);
      setReceiptTotal(json.total || 0);
    }
  }, [session, receiptPage, filtersReceipt]);

  const fetchExpenses = useCallback(async () => {
    if (!session?.access_token) return;
    const params = new URLSearchParams({
      page: String(expensePage),
      limit: "10",
      ...(filtersExpense.startDate ? { startDate: filtersExpense.startDate } : {}),
      ...(filtersExpense.endDate ? { endDate: filtersExpense.endDate } : {}),
      ...(filtersExpense.category ? { category: filtersExpense.category } : {})
    }).toString();
    const res = await apiFetch(`/api/expenses?${params}`);
    const json = await res.json();
    if (res.ok) {
      setExpenses(json.data || []);
      setExpenseTotal(json.total || 0);
    }
  }, [session, expensePage, filtersExpense]);

  const fetchReport = useCallback(async () => {
    if (!session?.access_token) return;
    const params = new URLSearchParams({
      ...(reportFilters.startDate ? { startDate: reportFilters.startDate } : {}),
      ...(reportFilters.endDate ? { endDate: reportFilters.endDate } : {})
    }).toString();
    const res = await apiFetch(`/api/reports/summary?${params}`);
    const json = await res.json();
    if (res.ok) setReport(json);
  }, [session, reportFilters]);

  useEffect(() => {
    fetchMe();
  }, [fetchMe]);

  useEffect(() => {
    fetchContribs();
    fetchReceipts();
    fetchExpenses();
    fetchReport();
  }, [fetchContribs, fetchReceipts, fetchExpenses, fetchReport]);

  // Realtime refresh (optional; if enabled in Supabase)
  useEffect(() => {
    if (!session?.access_token) return;
    const channel = supabase
      .channel("realtime:receipts_expenses")
      .on("postgres_changes", { event: "*", schema: "public", table: "receipts" }, () => {
        fetchReceipts();
        fetchReport();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "expenses" }, () => {
        fetchExpenses();
        fetchReport();
      })
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [session, fetchReceipts, fetchExpenses, fetchReport]);

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
    const res = await apiFetch("/api/contributions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ gbp_amount: Number(contribAmount), note: contribNote, sent_at: contribDate || null })
    });
    const json = await res.json();
    if (res.ok) {
      addToast("Contribution created");
      setContribAmount("");
      setContribNote("");
      setContribDate("");
      fetchContribs();
      fetchReport();
    } else addToast(json.error || "Error", "error");
  };

  // Developer: receipt
  const submitReceipt = async (e) => {
    e.preventDefault();
    const res = await apiFetch("/api/receipts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contribution_id: receiptContributionId,
        kes_received: Number(receiptKes),
        fx_rate: receiptFx ? Number(receiptFx) : null
      })
    });
    const json = await res.json();
    if (res.ok) {
      addToast("Receipt logged");
      setReceiptContributionId("");
      setReceiptKes("");
      setReceiptFx("");
      fetchReceipts();
      fetchReport();
    } else addToast(json.error || "Error", "error");
  };

  // Developer: expense
  const submitExpense = async (e) => {
    e.preventDefault();
    const res = await apiFetch("/api/expenses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        amount_kes: Number(expenseAmount),
        category: expenseCategory,
        expense_date: expenseDate,
        description: expenseDesc,
        receipt_url: expenseReceiptUrl || null
      })
    });
    const json = await res.json();
    if (res.ok) {
      addToast("Expense logged");
      setExpenseAmount("");
      setExpenseCategory("materials");
      setExpenseDate("");
      setExpenseDesc("");
      setExpenseReceiptUrl("");
      fetchExpenses();
      fetchReport();
    } else addToast(json.error || "Error", "error");
  };

  // Admin: approve receipt
  const submitApproveReceipt = async (e) => {
    e.preventDefault();
    const res = await apiFetch(`/api/admin/receipts/${approveReceiptId}/approve`, { method: "POST" });
    const json = await res.json();
    if (res.ok) {
      addToast("Receipt approved");
      setApproveReceiptId("");
      fetchReceipts();
      fetchReport();
    } else addToast(json.error || "Error", "error");
  };

  // Flag
  const doFlag = async (expenseId) => {
    const res = await apiFetch(`/api/expenses/${expenseId}/flag`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ flagged: true })
    });
    const json = await res.json();
    if (res.ok) {
      addToast("Expense flagged");
      fetchExpenses();
      fetchReport();
    } else addToast(json.error || "Error", "error");
  };

  // Comment
  const doComment = async (expenseId, text) => {
    const res = await apiFetch(`/api/expenses/${expenseId}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ comment: text })
    });
    const json = await res.json();
    if (res.ok) {
      addToast("Comment added");
    } else addToast(json.error || "Error", "error");
  };

  // Upload receipt (returns path)
  const submitUpload = async (e) => {
    e.preventDefault();
    if (!uploadFile) {
      addToast("Select a file", "error");
      return;
    }
    const formData = new FormData();
    formData.append("file", uploadFile);
    const res = await apiFetch("/api/uploads/receipt", { method: "POST", body: formData });
    const json = await res.json();
    if (res.ok) {
      addToast("Uploaded");
      setExpenseReceiptUrl(json.path);
      setUploadFile(null);
    } else {
      addToast(json.error || "Upload error", "error");
    }
  };

  // Export
  const downloadFile = async (path, filename, mime) => {
    const params = new URLSearchParams({
      ...(reportFilters.startDate ? { startDate: reportFilters.startDate } : {}),
      ...(reportFilters.endDate ? { endDate: reportFilters.endDate } : {})
    }).toString();
    const res = await apiFetch(`${path}?${params}`);
    if (!res.ok) {
      addToast("Export failed", "error");
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.type = mime;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Modals
  const [commentModal, setCommentModal] = useState({ open: false, id: null });
  const [commentInput, setCommentInput] = useState("");

  const openComment = (id) => {
    setCommentModal({ open: true, id });
    setCommentInput("");
  };
  const submitCommentModal = async () => {
    await doComment(commentModal.id, commentInput);
    setCommentModal({ open: false, id: null });
  };

  // Signed receipt viewer
  const viewReceipt = (receiptPath) => {
    if (!receiptPath) return;
    window.open(receiptPath, "_blank", "noopener,noreferrer");
  };

  // UI computed
  const sessionCard = me && !me.error && (
    <div className="card">
      <div className="text-sm text-ink/60">Logged in as</div>
      <div className="text-lg font-semibold text-ink">{me.full_name || "—"}</div>
      <div className="text-sm text-ink/80">{me.email}</div>
      <div className="text-sm">Role: <Badge>{me.role}</Badge></div>
      <button className="btn-ghost mt-2" onClick={handleLogout}>Logout</button>
    </div>
  );

  const balancesCard = (
    <div className="card">
      <div className="font-semibold">Developer Balance</div>
      <div className="text-2xl font-bold">KES {report?.balances?.balance_kes ?? "-"}</div>
      <div className="text-sm text-ink/70">Total Received: {report?.balances?.total_received_kes ?? "-"}</div>
      <div className="text-sm text-ink/70">Total Expenses: {report?.balances?.total_expenses_kes ?? "-"}</div>
    </div>
  );

  // Tabs content
  const renderDashboard = () => (
    <div className="grid gap-6">
      <section className="section">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="text-center md:text-left w-full">
            <h1 className="text-3xl font-bold text-ink">BrickLedger</h1>
            <p className="text-sm text-ink/70">Enabling smart & transparent investing back at home</p>
          </div>
          <div className="flex flex-col items-start gap-2 md:items-end w-full sm:w-auto">
            <span className="badge">{apiStatus}</span>
            {!session ? (
              <form onSubmit={handleLogin} className="glass p-4 w-full sm:w-80 flex flex-col gap-2 border border-white/50">
                <h3 className="text-lg font-semibold text-ink">Sign In</h3>
                <input className="input" type="email" placeholder="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
                <input className="input" type="password" placeholder="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
                <button className="btn-primary" type="submit">Sign In</button>
                {authError && <span className="text-sm text-red-600">{authError}</span>}
              </form>
            ) : (
              sessionCard
            )}
          </div>
        </div>
      </section>

      {report && (
        <section className="section">
          <div className="grid gap-4 md:grid-cols-3">
            {balancesCard}
            <div className="card">
              <div className="font-semibold">Contributions (GBP)</div>
              <ul className="text-sm list-disc list-inside">
                {(report.contributions_by_investor || []).map((c) => (
                  <li key={c.investor_id}>{c.investor_name || c.investor_id}: GBP {c.total_gbp}</li>
                ))}
              </ul>
            </div>
            <div className="card">
              <div className="font-semibold">Expenses by Category</div>
              <ul className="text-sm list-disc list-inside">
                {(report.expenses_by_category || []).map((e, i) => (
                  <li key={i}>{e.category}: KES {e.total_kes}</li>
                ))}
              </ul>
            </div>
          </div>
        </section>
      )}

      <section className="grid gap-6 lg:grid-cols-3">
        <div className="section">
          <div className="flex items-center justify-between mb-2">
            <h3 className="heading">Contributions</h3>
            <Filters filters={filtersContrib} setFilters={setFiltersContrib} includeStatus includeCategory={false} />
          </div>
          <div className="space-y-2 max-h-96 overflow-auto text-sm">
            {contribs.map((c) => (
              <div key={c.id} className="card">
                <div className="flex justify-between items-center">
                  <div className="text-lg font-semibold">GBP {c.gbp_amount}</div>
                  <Badge tone={c.locked ? "locked" : c.status === "pending" ? "pending" : "approved"}>{c.status}</Badge>
                </div>
                <div className="text-ink/70 text-sm">{c.note || "No note"}</div>
                <div className="text-xs text-ink/60">{c.created_at}</div>
              </div>
            ))}
          </div>
          <Pagination page={contribPage} total={contribTotal} limit={10} onPage={setContribPage} />
        </div>

        <div className="section">
          <div className="flex items-center justify-between mb-2">
            <h3 className="heading">Receipts</h3>
            <Filters filters={filtersReceipt} setFilters={setFiltersReceipt} includeStatus includeCategory={false} />
          </div>
          <div className="space-y-2 max-h-96 overflow-auto text-sm">
            {receipts.map((r) => (
              <div key={r.id} className="card">
                <div className="flex justify-between items-center">
                  <div className="text-lg font-semibold">KES {r.kes_received}</div>
                  <Badge tone={r.approved ? "approved" : "pending"}>{r.approved ? "approved" : "pending"}</Badge>
                </div>
                <div className="text-xs text-ink/60">{r.created_at}</div>
              </div>
            ))}
          </div>
          <Pagination page={receiptPage} total={receiptTotal} limit={10} onPage={setReceiptPage} />
        </div>

        <div className="section">
          <div className="flex items-center justify-between mb-2">
            <h3 className="heading">Expenses</h3>
            <Filters filters={filtersExpense} setFilters={setFiltersExpense} includeStatus={false} includeCategory />
          </div>
          <div className="space-y-2 max-h-96 overflow-auto">
            {expenses.map((e) => (
              <ExpenseCard
                key={e.id}
                expense={e}
                onFlag={(id) => doFlag(id)}
                onComment={(id) => openComment(id)}
                onViewReceipt={(url) => viewReceipt(url)}
              />
            ))}
          </div>
          <Pagination page={expensePage} total={expenseTotal} limit={10} onPage={setExpensePage} />
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
            {expenseReceiptUrl && <p className="subtle break-all">Path saved: {expenseReceiptUrl}</p>}
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
          <h3 className="heading">Exports</h3>
          <div className="flex flex-wrap gap-3">
            <button className="btn-primary" type="button" onClick={() => downloadFile("/api/export/pdf", "financials.pdf", "application/pdf")}>
              Download PDF
            </button>
            <button
              className="btn-primary"
              type="button"
              onClick={() =>
                downloadFile("/api/export/excel", "financials.xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
              }
            >
              Download Excel
            </button>
          </div>
        </section>
      )}
    </div>
  );

  const renderReports = () => (
    <div className="grid gap-4">
      <div className="flex items-center justify-between">
        <h2 className="heading">Reports</h2>
        <Filters filters={reportFilters} setFilters={setReportFilters} includeStatus={false} includeCategory={false} />
      </div>
      {report ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {balancesCard}
          <div className="card">
            <div className="font-semibold">Monthly Cashflow</div>
            <ul className="text-sm list-disc list-inside">
              {(report.monthly_cashflow || []).map((m, i) => (
                <li key={i}>
                  {m.month}: inflow {m.inflow_kes}, outflow {m.outflow_kes}, net {m.net_kes}
                </li>
              ))}
            </ul>
          </div>
          <div className="card">
            <div className="font-semibold">Actions</div>
            <div className="flex flex-wrap gap-2">
              <button className="btn-primary" type="button" onClick={() => downloadFile("/api/export/pdf", "financials.pdf", "application/pdf")}>
                Download PDF
              </button>
              <button
                className="btn-primary"
                type="button"
                onClick={() =>
                  downloadFile("/api/export/excel", "financials.xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
                }
              >
                Download Excel
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="card skeleton h-24" />
      )}
    </div>
  );

  return (
    <div className="space-y-6 pb-24">
      <Toasts toasts={toasts} remove={removeToast} />

      <div className="tabs">
        <button className={`tab ${tab === "dashboard" ? "tab-active" : ""}`} onClick={() => setTab("dashboard")}>Dashboard</button>
        <button className={`tab ${tab === "reports" ? "tab-active" : ""}`} onClick={() => setTab("reports")}>Reports</button>
      </div>

      {tab === "dashboard" ? renderDashboard() : renderReports()}

      {/* Comment modal */}
      <Modal open={commentModal.open} onClose={() => setCommentModal({ open: false, id: null })} title="Add Comment">
        <textarea className="input h-28" value={commentInput} onChange={(e) => setCommentInput(e.target.value)} placeholder="Add your note" />
        <div className="mt-3 flex gap-2 justify-end">
          <button className="btn-ghost" onClick={() => setCommentModal({ open: false, id: null })}>Cancel</button>
          <button className="btn-primary" onClick={submitCommentModal}>Submit</button>
        </div>
      </Modal>
    </div>
  );
}