"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { supabase } from "@/lib/supabaseClient";
import { api } from "@/lib/apiClient";

const PAGE_SIZE = 10;
const defaultDateRange = () => {
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - 29);
  const fmt = (d) => d.toISOString().slice(0, 10);
  return { start: fmt(start), end: fmt(end) };
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
  const add = (message, type = "success") => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => remove(id), 4000);
  };
  const remove = (id) => setToasts((prev) => prev.filter((t) => t.id !== id));
  return { toasts, add, remove };
}

function Pagination({ page, totalPages, onPage }) {
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center gap-2 mt-3">
      <button className="btn-ghost" disabled={page <= 1} onClick={() => onPage(page - 1)}>
        Prev
      </button>
      <span className="text-sm text-ink/70">
        Page {page} / {totalPages}
      </span>
      <button className="btn-ghost" disabled={page >= totalPages} onClick={() => onPage(page + 1)}>
        Next
      </button>
    </div>
  );
}

function SectionSkeleton() {
  return <div className="skeleton h-32 w-full" />;
}

export default function Home() {
  const { toasts, add: addToast, remove: removeToast } = useToasts();
  const [tab, setTab] = useState("dashboard");
  const [apiStatus, setApiStatus] = useState("Checking...");
  const [session, setSession] = useState(null);
  const [me, setMe] = useState(null);
  const [authError, setAuthError] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loadingMe, setLoadingMe] = useState(false);

  // Filters & pagination
  const [filters, setFilters] = useState(() => {
    const { start, end } = defaultDateRange();
    return { startDate: start, endDate: end, status: "", category: "" };
  });
  const [pageState, setPageState] = useState({
    contributions: 1,
    receipts: 1,
    expenses: 1,
  });

  // Data
  const [contribs, setContribs] = useState([]);
  const [receipts, setReceipts] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [counts, setCounts] = useState({ contributions: 0, receipts: 0, expenses: 0 });
  const [report, setReport] = useState(null);
  const [loadingLists, setLoadingLists] = useState(false);
  const [loadingReport, setLoadingReport] = useState(false);

  // Forms
  const [contribAmount, setContribAmount] = useState("");
  const [contribNote, setContribNote] = useState("");
  const [receiptContributionId, setReceiptContributionId] = useState("");
  const [receiptKes, setReceiptKes] = useState("");
  const [receiptFx, setReceiptFx] = useState("");
  const [expenseAmount, setExpenseAmount] = useState("");
  const [expenseCategory, setExpenseCategory] = useState("materials");
  const [expenseDate, setExpenseDate] = useState("");
  const [expenseDesc, setExpenseDesc] = useState("");
  const [expenseReceiptUrl, setExpenseReceiptUrl] = useState("");
  const [approveReceiptId, setApproveReceiptId] = useState("");
  const [commentModal, setCommentModal] = useState({ open: false, expenseId: "", text: "" });
  const [flagModal, setFlagModal] = useState({ open: false, expenseId: "" });
  const [uploadFile, setUploadFile] = useState(null);

  const role = me?.role;
  const isAdmin = role === "admin";
  const isInvestor = role === "investor";
  const isDev = role === "developer";

  // Health
  useEffect(() => {
    const check = async () => {
      try {
        const res = await fetch("/health");
        const ok = res.ok;
        const json = ok ? await res.json() : {};
        setApiStatus(ok ? `API OK${json.audit_mode ? " (audit mode)" : ""}` : "API error");
      } catch (err) {
        setApiStatus(`API unreachable: ${err.message}`);
      }
    };
    check();
  }, []);

  // Session listener
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
    setLoadingMe(true);
    try {
      const data = await api.get("/api/me");
      setMe(data);
    } catch (err) {
      setMe({ error: err.message });
    } finally {
      setLoadingMe(false);
    }
  }, [session]);

  const fetchLists = useCallback(async () => {
    if (!session?.access_token) return;
    setLoadingLists(true);
    try {
      const qs = (pageKey) =>
        `?page=${pageState[pageKey]}&limit=${PAGE_SIZE}` +
        (filters.startDate ? `&startDate=${filters.startDate}` : "") +
        (filters.endDate ? `&endDate=${filters.endDate}` : "") +
        (filters.status ? `&status=${filters.status}` : "") +
        (filters.category ? `&category=${filters.category}` : "");
      const [c, r, e] = await Promise.all([
        api.get(`/api/contributions${qs("contributions")}`),
        api.get(`/api/receipts${qs("receipts")}`),
        api.get(`/api/expenses${qs("expenses")}`),
      ]);
      setContribs(c.data || []);
      setReceipts(r.data || []);
      setExpenses(e.data || []);
      setCounts({
        contributions: c.total || 0,
        receipts: r.total || 0,
        expenses: e.total || 0,
      });
    } catch (err) {
      addToast(err.message, "error");
    } finally {
      setLoadingLists(false);
    }
  }, [session, filters, pageState, addToast]);

  const fetchReport = useCallback(async () => {
    if (!session?.access_token) return;
    setLoadingReport(true);
    try {
      const qs =
        `?startDate=${filters.startDate || ""}&endDate=${filters.endDate || ""}&scope=all`;
      const data = await api.get(`/api/reports/summary${qs}`);
      setReport(data);
    } catch (err) {
      addToast(err.message, "error");
    } finally {
      setLoadingReport(false);
    }
  }, [session, filters, addToast]);

  useEffect(() => {
    fetchMe();
    fetchLists();
    fetchReport();
  }, [fetchMe, fetchLists, fetchReport]);

  // Realtime refresh (receipts/expenses)
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

  // Forms
  const submitContribution = async (e) => {
    e.preventDefault();
    try {
      await api.post("/api/contributions", { gbp_amount: Number(contribAmount), note: contribNote });
      addToast("Contribution created");
      setContribAmount("");
      setContribNote("");
      fetchLists();
      fetchReport();
    } catch (err) {
      addToast(err.message, "error");
    }
  };
  const submitReceipt = async (e) => {
    e.preventDefault();
    try {
      await api.post("/api/receipts", {
        contribution_id: receiptContributionId,
        kes_received: Number(receiptKes),
        fx_rate: receiptFx ? Number(receiptFx) : null,
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
  const submitExpense = async (e) => {
    e.preventDefault();
    try {
      await api.post("/api/expenses", {
        amount_kes: Number(expenseAmount),
        category: expenseCategory,
        expense_date: expenseDate,
        description: expenseDesc,
        receipt_url: expenseReceiptUrl || null,
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
  const submitApproveReceipt = async (e) => {
    e.preventDefault();
    try {
      await api.post(`/api/admin/receipts/${approveReceiptId}/approve`);
      addToast("Receipt approved");
      setApproveReceiptId("");
      fetchLists();
      fetchReport();
    } catch (err) {
      addToast(err.message, "error");
    }
  };
  const submitComment = async () => {
    try {
      await api.post(`/api/expenses/${commentModal.expenseId}/comments`, { comment: commentModal.text });
      addToast("Comment added");
      setCommentModal({ open: false, expenseId: "", text: "" });
    } catch (err) {
      addToast(err.message, "error");
    }
  };
  const submitFlag = async () => {
    try {
      await api.post(`/api/expenses/${flagModal.expenseId}/flag`, { flagged: true });
      addToast("Expense flagged");
      setFlagModal({ open: false, expenseId: "" });
      fetchLists();
      fetchReport();
    } catch (err) {
      addToast(err.message, "error");
    }
  };
  const submitUpload = async (e) => {
    e.preventDefault();
    if (!uploadFile) return addToast("Select a file", "error");
    const formData = new FormData();
    formData.append("file", uploadFile);
    try {
      const res = await api.post("/api/uploads/receipt", formData, { headers: {} , raw: false });
      addToast("Uploaded");
      setUploadFile(null);
    } catch (err) {
      addToast(err.message, "error");
    }
  };

  const downloadExport = async (path, filename, mime) => {
    try {
      const res = await api.get(path, { raw: true, headers: {} });
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.type = mime;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      addToast(err.message, "error");
    }
  };

  const totalPages = useMemo(() => ({
    contributions: Math.max(1, Math.ceil(counts.contributions / PAGE_SIZE)),
    receipts: Math.max(1, Math.ceil(counts.receipts / PAGE_SIZE)),
    expenses: Math.max(1, Math.ceil(counts.expenses / PAGE_SIZE)),
  }), [counts]);

  const roleLabel = role ? role.charAt(0).toUpperCase() + role.slice(1) : "Unknown";

  return (
    <div className="space-y-6 pb-24">
      <Toasts toasts={toasts} remove={removeToast} />

      <header className="section">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between text-center md:text-left">
          <div className="w-full">
            <h1 className="text-3xl font-bold text-ink">BrickLedger</h1>
            <p className="subtle mt-1">Enabling smart & transparent investing back at home</p>
          </div>
          <div className="flex flex-col items-center md:items-end gap-2 w-full md:w-auto">
            <span className="badge">{apiStatus}</span>
            {session ? (
              <div className="glass px-4 py-3 border border-white/60 w-full md:w-72 text-left">
                <div className="text-sm font-semibold text-ink">
                  Logged in as: {me?.full_name || session.user.email}
                </div>
                <div className="text-xs text-ink/70 mt-1">Role: {roleLabel}</div>
                <div className="text-xs text-ink/70 break-words">{session.user.email}</div>
                <div className="text-xs text-ink/60 mt-1">
                  Last login: {session.user.last_sign_in_at ? new Date(session.user.last_sign_in_at).toLocaleString() : "—"}
                </div>
                <button className="btn-ghost mt-2 w-full" onClick={handleLogout}>
                  Logout
                </button>
              </div>
            ) : (
              <form
                onSubmit={handleLogin}
                className="glass p-4 w-full md:w-80 flex flex-col gap-2 border border-white/50"
              >
                <h3 className="text-lg font-semibold text-ink text-center md:text-left">Sign In</h3>
                <input className="input" type="email" placeholder="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
                <input className="input" type="password" placeholder="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
                <button className="btn-primary" type="submit">
                  Sign In
                </button>
                {authError && <span className="text-sm text-red-600">{authError}</span>}
              </form>
            )}
          </div>
        </div>
      </header>

      {/* Tabs */}
      <div className="section flex flex-wrap gap-2">
        {["dashboard", "reports"].map((t) => (
          <button
            key={t}
            className={`tab ${tab === t ? "tab-active" : ""}`}
            onClick={() => setTab(t)}
          >
            {t === "dashboard" ? "Dashboard" : "Reports"}
          </button>
        ))}
      </div>

      {tab === "dashboard" && (
        <>
          {/* Filters */}
          <section className="section">
            <h3 className="heading">Filters</h3>
            <div className="grid gap-4 md:grid-cols-4">
              <div>
                <label className="label">Start date</label>
                <input
                  className="input"
                  type="date"
                  value={filters.startDate}
                  onChange={(e) => setFilters((f) => ({ ...f, startDate: e.target.value }))}
                />
              </div>
              <div>
                <label className="label">End date</label>
                <input
                  className="input"
                  type="date"
                  value={filters.endDate}
                  onChange={(e) => setFilters((f) => ({ ...f, endDate: e.target.value }))}
                />
              </div>
              <div>
                <label className="label">Status</label>
                <select
                  className="input"
                  value={filters.status}
                  onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}
                >
                  <option value="">All</option>
                  <option value="pending">Pending</option>
                  <option value="confirmed">Confirmed</option>
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                </select>
              </div>
              <div>
                <label className="label">Category (expenses)</label>
                <select
                  className="input"
                  value={filters.category}
                  onChange={(e) => setFilters((f) => ({ ...f, category: e.target.value }))}
                >
                  <option value="">All</option>
                  <option value="materials">Materials</option>
                  <option value="labour">Labour</option>
                  <option value="other">Other</option>
                </select>
              </div>
            </div>
            <div className="flex gap-2 mt-3">
              <button className="btn-primary" type="button" onClick={() => { setPageState({ contributions:1, receipts:1, expenses:1 }); fetchLists(); fetchReport(); }}>
                Apply
              </button>
              <button className="btn-ghost" type="button" onClick={() => {
                const { start, end } = defaultDateRange();
                setFilters({ startDate: start, endDate: end, status: "", category: "" });
                setPageState({ contributions:1, receipts:1, expenses:1 });
                fetchLists();
                fetchReport();
              }}>
                Reset (last 30d)
              </button>
            </div>
          </section>

          {/* Lists */}
          <section className="grid gap-6 lg:grid-cols-3">
            <div className="section">
              <h3 className="heading">Contributions (GBP)</h3>
              {loadingLists ? <SectionSkeleton /> : (
                <>
                  <pre className="bg-white/80 rounded-xl p-3 border border-white/60 text-xs max-h-64 overflow-auto">
{JSON.stringify(contribs, null, 2)}
                  </pre>
                  <Pagination
                    page={pageState.contributions}
                    totalPages={totalPages.contributions}
                    onPage={(p) => setPageState((s) => ({ ...s, contributions: p })) || fetchLists()}
                  />
                </>
              )}
            </div>
            <div className="section">
              <h3 className="heading">Receipts</h3>
              {loadingLists ? <SectionSkeleton /> : (
                <>
                  <pre className="bg-white/80 rounded-xl p-3 border border-white/60 text-xs max-h-64 overflow-auto">
{JSON.stringify(receipts, null, 2)}
                  </pre>
                  <Pagination
                    page={pageState.receipts}
                    totalPages={totalPages.receipts}
                    onPage={(p) => setPageState((s) => ({ ...s, receipts: p })) || fetchLists()}
                  />
                </>
              )}
            </div>
            <div className="section">
              <h3 className="heading">Expenses</h3>
              {loadingLists ? <SectionSkeleton /> : (
                <>
                  <div className="space-y-3 max-h-80 overflow-auto pr-1">
                    {expenses.length === 0 && <p className="subtle">No expenses.</p>}
                    {expenses.map((ex) => (
                      <div key={ex.id} className="glass p-3 border border-white/60 flex flex-col gap-2">
                        <div className="flex justify-between items-center">
                          <div className="text-sm font-semibold text-ink">KES {ex.amount_kes}</div>
                          <span className="badge capitalize">{ex.category}</span>
                        </div>
                        <div className="text-xs text-ink/70">{ex.expense_date}</div>
                        <div className="text-sm text-ink/80">{ex.description || "—"}</div>
                        {ex.receipt_url && (
                          <a className="text-xs text-ink underline" href={ex.receipt_url} target="_blank" rel="noreferrer">
                            View receipt
                          </a>
                        )}
                        <div className="flex gap-2">
                          <button className="btn-ghost w-full" onClick={() => setCommentModal({ open: true, expenseId: ex.id, text: "" })}>
                            Comment
                          </button>
                          <button className="btn-primary w-full" onClick={() => setFlagModal({ open: true, expenseId: ex.id })}>
                            Flag
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                  <Pagination
                    page={pageState.expenses}
                    totalPages={totalPages.expenses}
                    onPage={(p) => setPageState((s) => ({ ...s, expenses: p })) || fetchLists()}
                  />
                </>
              )}
            </div>
          </section>

          {/* Forms */}
          <div className="grid gap-6 lg:grid-cols-2">
            {(isInvestor || isAdmin) && (
              <section className="section" id="contrib-form">
                <h3 className="heading">Investor: Create Contribution (GBP)</h3>
                <form onSubmit={submitContribution} className="space-y-3">
                  <div>
                    <label className="label">GBP amount</label>
                    <input className="input" type="number" step="0.01" placeholder="1000.00" value={contribAmount} onChange={(e) => setContribAmount(e.target.value)} required />
                  </div>
                  <div>
                    <label className="label">Note (optional)</label>
                    <textarea className="input h-24" placeholder="Description or reference" value={contribNote} onChange={(e) => setContribNote(e.target.value)} />
                  </div>
                  <button className="btn-primary" type="submit">Create Contribution</button>
                </form>
              </section>
            )}

            {(isDev || isAdmin) && (
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

          {(isDev || isAdmin) && (
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

          {(isDev || isAdmin) && (
            <section className="section">
              <h3 className="heading">Developer: Upload Receipt</h3>
              <form onSubmit={submitUpload} className="flex flex-col gap-3 max-w-md">
                <input type="file" accept=".pdf,.png,.jpg,.jpeg,.webp" onChange={(e) => setUploadFile(e.target.files?.[0] || null)} className="input" />
                <button className="btn-primary" type="submit">Upload</button>
              </form>
            </section>
          )}

          {isAdmin && (
            <section className="section" id="approve-form">
              <h3 className="heading">Admin: Approve Receipt</h3>
              <form onSubmit={submitApproveReceipt} className="flex flex-col gap-3 max-w-md">
                <input className="input" type="text" placeholder="receipt_id" value={approveReceiptId} onChange={(e) => setApproveReceiptId(e.target.value)} required />
                <button className="btn-primary" type="submit">Approve Receipt</button>
              </form>
            </section>
          )}

          {/* Modals */}
          {commentModal.open && (
            <div className="modal">
              <div className="modal-content">
                <h4 className="heading">Add Comment</h4>
                <textarea
                  className="input h-24"
                  placeholder="Add your note"
                  value={commentModal.text}
                  onChange={(e) => setCommentModal((m) => ({ ...m, text: e.target.value }))}
                  required
                />
                <div className="flex gap-2 mt-3">
                  <button className="btn-primary" onClick={submitComment}>Submit</button>
                  <button className="btn-ghost" onClick={() => setCommentModal({ open: false, expenseId: "", text: "" })}>Cancel</button>
                </div>
              </div>
            </div>
          )}
          {flagModal.open && (
            <div className="modal">
              <div className="modal-content">
                <h4 className="heading">Flag Expense</h4>
                <p className="text-sm text-ink/70">Are you sure you want to flag this expense?</p>
                <div className="flex gap-2 mt-3">
                  <button className="btn-primary" onClick={submitFlag}>Flag</button>
                  <button className="btn-ghost" onClick={() => setFlagModal({ open: false, expenseId: "" })}>Cancel</button>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {tab === "reports" && (
        <section className="section">
          <div className="flex items-center justify-between mb-4">
            <h3 className="heading">Reports</h3>
            <div className="flex gap-2">
              <button className="btn-primary" onClick={() => downloadExport("/api/export/pdf", "financials.pdf", "application/pdf")}>Download PDF</button>
              <button className="btn-primary" onClick={() => downloadExport("/api/export/excel", "financials.xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")}>Download Excel</button>
            </div>
          </div>
          {loadingReport ? <SectionSkeleton /> : report ? (
            <div className="grid gap-4 md:grid-cols-2">
              <div className="glass p-4">
                <div className="font-semibold">Developer Balance</div>
                <div className="text-sm">Balance (KES): {report.balances?.balance_kes ?? "-"}</div>
              </div>
              <div className="glass p-4">
                <div className="font-semibold">Total Contributions</div>
                <div className="text-sm">Total GBP: {report.balances?.total_received_gbp ?? "-"}</div>
                <div className="text-sm">Total KES (confirmed): {report.balances?.total_received_kes ?? "-"}</div>
              </div>
              <div className="glass p-4">
                <div className="font-semibold">Total Expenses</div>
                <div className="text-sm">KES: {report.balances?.total_expenses_kes ?? "-"}</div>
              </div>
              <div className="glass p-4">
                <div className="font-semibold">Monthly Cashflow</div>
                <ul className="list-disc list-inside text-sm">
                  {(report.monthly_cashflow || []).map((m, i) => (
                    <li key={i}>
                      {m.month}: inflow {m.inflow_kes}, outflow {m.outflow_kes}, net {m.net_kes}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ) : (
            <p className="subtle">No report data.</p>
          )}
        </section>
      )}
    </div>
  );
}