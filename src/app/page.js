"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "../lib/supabaseClient";
import { apiFetch } from "../lib/apiClient";

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

export default function Home() {
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
  const [contribDateSent, setContribDateSent] = useState("");
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
  const [receiptViewUrl, setReceiptViewUrl] = useState("");

  // Filters & pagination
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");

  // Lists
  const [contribs, setContribs] = useState([]);
  const [receipts, setReceipts] = useState([]);
  const [expenses, setExpenses] = useState([]);

  // Reports
  const [report, setReport] = useState(null);
  const [activeTab, setActiveTab] = useState("dashboard"); // dashboard | reports

  // Health
  useEffect(() => {
    const check = async () => {
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE || "https://building-financials-backend.onrender.com"}/health`);
        const json = await res.json();
        setApiStatus(json.ok ? `API OK${json.audit_mode ? " (audit mode)" : ""}` : `API error: ${json.error}`);
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
    try {
      const json = await apiFetch("/api/me");
      setMe(json);
    } catch (err) {
      setMe({ error: err.message });
    }
  }, [session]);

  const fetchLists = useCallback(async () => {
    if (!session?.access_token) return;
    try {
      const query = (base) => {
        const params = new URLSearchParams();
        params.set("page", page.toString());
        params.set("limit", limit.toString());
        if (startDate) params.set("startDate", startDate);
        if (endDate) params.set("endDate", endDate);
        if (statusFilter) params.set("status", statusFilter);
        if (categoryFilter) params.set("category", categoryFilter);
        return `${base}?${params.toString()}`;
      };
      const [cJson, rJson, eJson] = await Promise.all([
        apiFetch(query("/api/contributions")),
        apiFetch(query("/api/receipts")),
        apiFetch(query("/api/expenses"))
      ]);
      setContribs(cJson || []);
      setReceipts(rJson || []);
      setExpenses(eJson || []);
    } catch (err) {
      addToast(err.message, "error");
    }
  }, [session, page, limit, startDate, endDate, statusFilter, categoryFilter, addToast]);

  const fetchReport = useCallback(async () => {
    if (!session?.access_token) return;
    try {
      const params = new URLSearchParams();
      if (startDate) params.set("startDate", startDate);
      if (endDate) params.set("endDate", endDate);
      const json = await apiFetch(`/api/reports/summary?${params.toString()}`);
      setReport(json);
    } catch (err) {
      addToast(err.message, "error");
    }
  }, [session, startDate, endDate, addToast]);

  useEffect(() => {
    fetchMe();
    fetchLists();
    fetchReport();
  }, [fetchMe, fetchLists, fetchReport]);

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
      await apiFetch("/api/contributions", {
        method: "POST",
        body: {
          gbp_amount: Number(contribAmount),
          date_sent: contribDateSent || null,
          note: contribNote
        }
      });
      addToast("Contribution created");
      setContribAmount("");
      setContribNote("");
      setContribDateSent("");
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
      await apiFetch("/api/receipts", {
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
      await apiFetch("/api/expenses", {
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
      await apiFetch(`/api/admin/receipts/${approveReceiptId}/approve`, { method: "POST" });
      addToast("Receipt approved");
      setApproveReceiptId("");
      fetchLists();
      fetchReport();
    } catch (err) {
      addToast(err.message, "error");
    }
  };

  // Flag
  const submitFlag = async (e) => {
    e.preventDefault();
    try {
      await apiFetch(`/api/expenses/${flagExpenseId}/flag`, {
        method: "POST",
        body: { flagged: true }
      });
      addToast("Expense flagged");
      setFlagExpenseId("");
      fetchLists();
      fetchReport();
    } catch (err) {
      addToast(err.message, "error");
    }
  };

  // Comment
  const submitComment = async (e) => {
    e.preventDefault();
    try {
      await apiFetch(`/api/expenses/${commentExpenseId}/comments`, {
        method: "POST",
        body: { comment: commentText }
      });
      addToast("Comment added");
      setCommentExpenseId("");
      setCommentText("");
    } catch (err) {
      addToast(err.message, "error");
    }
  };

  // Upload receipt
  const submitUpload = async (e) => {
    e.preventDefault();
    if (!uploadFile) return addToast("Select a file", "error");
    const formData = new FormData();
    formData.append("file", uploadFile);
    try {
      await apiFetch("/api/uploads/receipt", { method: "POST", body: formData });
      addToast("Uploaded");
      setUploadFile(null);
    } catch (err) {
      addToast(err.message, "error");
    }
  };

  // View receipt (signed URL)
  const viewReceipt = async (id) => {
    try {
      const { url } = await apiFetch(`/api/receipts/${id}/signed-url`);
      setReceiptViewUrl(url);
    } catch (err) {
      addToast(err.message, "error");
    }
  };

  // Exports
  const downloadFile = async (path, filename, mime) => {
    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE || "https://building-financials-backend.onrender.com"}${path}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      if (!res.ok) throw new Error("Export failed");
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

  const role = me?.role;
  const fullName = me?.full_name || "—";
  const lastLogin = me?.last_sign_in_at || session?.user?.last_sign_in_at || "—";

  return (
    <div className="space-y-6 pb-24">
      <Toasts toasts={toasts} remove={removeToast} />

      {/* Header */}
      <header className="section">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="text-center md:text-left">
            <h1 className="text-3xl font-bold text-ink">BrickLedger</h1>
            <p className="text-sm text-ink/70">Enabling smart & transparent investing back at home</p>
          </div>
          <div className="flex flex-col items-start gap-2 md:items-end w-full sm:w-auto">
            <span className="badge">{apiStatus}</span>
            {session ? (
              <div className="glass p-3 rounded-xl border border-white/50 text-sm w-full sm:w-auto">
                <div className="font-semibold text-ink">Logged in as: {fullName}</div>
                <div className="text-ink/80 break-words">{session.user.email}</div>
                <div className="text-ink/60">Role: {role || "—"}</div>
                <div className="text-ink/60">Last login: {lastLogin}</div>
                <button className="btn-ghost mt-3 w-full sm:w-auto" onClick={handleLogout}>
                  Logout
                </button>
              </div>
            ) : (
              <form onSubmit={handleLogin} className="glass p-4 w-full sm:w-80 flex flex-col gap-2 border border-white/50">
                <h3 className="text-lg font-semibold text-ink">Sign In</h3>
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
      <div className="glass flex gap-2 p-2 rounded-xl w-full">
        <button
          className={`btn ${activeTab === "dashboard" ? "btn-primary" : "btn-ghost"}`}
          onClick={() => setActiveTab("dashboard")}
        >
          Dashboard
        </button>
        <button
          className={`btn ${activeTab === "reports" ? "btn-primary" : "btn-ghost"}`}
          onClick={() => setActiveTab("reports")}
        >
          Reports
        </button>
      </div>

      {activeTab === "dashboard" && (
        <>
          {/* Lists */}
          <section className="grid gap-6 lg:grid-cols-3">
            <div className="section">
              <h3 className="heading">Contributions (GBP)</h3>
              <pre className="bg-white/80 rounded-xl p-3 border border-white/60 text-xs max-h-64 overflow-auto">
{JSON.stringify(contribs, null, 2)}
              </pre>
            </div>
            <div className="section">
              <h3 className="heading">Receipts</h3>
              <pre className="bg-white/80 rounded-xl p-3 border border-white/60 text-xs max-h-64 overflow-auto">
{JSON.stringify(receipts, null, 2)}
              </pre>
            </div>
            <div className="section">
              <h3 className="heading">Expenses</h3>
              <pre className="bg-white/80 rounded-xl p-3 border border-white/60 text-xs max-h-64 overflow-auto">
{JSON.stringify(expenses, null, 2)}
              </pre>
            </div>
          </section>

          {/* Filters & pagination */}
          <section className="section">
            <h3 className="heading">Filters & Pagination</h3>
            <div className="grid gap-3 md:grid-cols-3">
              <input className="input" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} placeholder="Start date" />
              <input className="input" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} placeholder="End date" />
              <select className="input" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                <option value="">Status (any)</option>
                <option value="pending">pending</option>
                <option value="approved">approved</option>
                <option value="confirmed">confirmed</option>
                <option value="rejected">rejected</option>
              </select>
              <select className="input" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
                <option value="">Category (any)</option>
                <option value="materials">materials</option>
                <option value="labour">labour</option>
                <option value="other">other</option>
              </select>
            </div>
            <div className="flex gap-3 mt-3">
              <button className="btn-primary" type="button" onClick={() => { setPage(1); fetchLists(); fetchReport(); }}>
                Apply Filters
              </button>
              <div className="flex items-center gap-2">
                <button className="btn-ghost" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>Prev</button>
                <span className="text-sm text-ink/70">Page {page}</span>
                <button className="btn-ghost" onClick={() => setPage((p) => p + 1)}>Next</button>
              </div>
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
                    <input className="input" type="date" value={contribDateSent} onChange={(e) => setContribDateSent(e.target.value)} />
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

          {(role === "investor" || role === "admin") && (
            <section className="section">
              <h3 className="heading">Flags & Comments</h3>
              <div className="grid gap-4 md:grid-cols-2">
                <form onSubmit={submitFlag} className="flex flex-col gap-3 glass p-4">
                  <div>
                    <label className="label">Expense ID to flag</label>
                    <input className="input" type="text" placeholder="expense_id" value={flagExpenseId} onChange={(e) => setFlagExpenseId(e.target.value)} required />
                  </div>
                  <button className="btn-primary" type="submit">Flag Expense</button>
                </form>

                <form onSubmit={submitComment} className="flex flex-col gap-3 glass p-4">
                  <div>
                    <label className="label">Expense ID to comment</label>
                    <input className="input" type="text" placeholder="expense_id" value={commentExpenseId} onChange={(e) => setCommentExpenseId(e.target.value)} required />
                  </div>
                  <div>
                    <label className="label">Comment</label>
                    <textarea className="input h-20" placeholder="Add your note" value={commentText} onChange={(e) => setCommentText(e.target.value)} required />
                  </div>
                  <button className="btn-primary" type="submit">Add Comment</button>
                </form>
              </div>
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
            </section>
          )}
        </>
      )}

      {activeTab === "reports" && (
        <section className="section">
          <h3 className="heading">Reports</h3>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="label">Start date</label>
              <input className="input" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div>
              <label className="label">End date</label>
              <input className="input" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
          </div>
          <button className="btn-primary mt-3" onClick={() => fetchReport()}>Apply</button>

          <div className="mt-4 space-y-3 text-sm">
            <div className="glass p-3">
              <div className="font-semibold">Balances</div>
              <div>Total Received (KES): {report?.balances?.total_received_kes ?? "-"}</div>
              <div>Total Expenses (KES): {report?.balances?.total_expenses_kes ?? "-"}</div>
              <div>Balance (KES): {report?.balances?.balance_kes ?? "-"}</div>
            </div>
            <div className="glass p-3">
              <div className="font-semibold">Contributions by Investor (GBP)</div>
              <ul className="list-disc list-inside">
                {(report?.contributions_by_investor || []).map((c) => (
                  <li key={c.investor_id}>{(c.investor_name || c.investor_id)} — GBP {c.total_gbp}</li>
                ))}
              </ul>
            </div>
            <div className="glass p-3">
              <div className="font-semibold">Expenses by Category</div>
              <ul className="list-disc list-inside">
                {(report?.expenses_by_category || []).map((e, i) => (
                  <li key={i}>{e.category}: KES {e.total_kes}</li>
                ))}
              </ul>
            </div>
            <div className="glass p-3">
              <div className="font-semibold">Monthly Cashflow</div>
              <ul className="list-disc list-inside">
                {(report?.monthly_cashflow || []).map((m, i) => (
                  <li key={i}>
                    {m.month}: inflow {m.inflow_kes}, outflow {m.outflow_kes}, net {m.net_kes}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>
      )}

      {/* Receipt preview modal */}
      {receiptViewUrl && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass p-4 max-w-3xl w-full h-[80vh] overflow-hidden">
            <div className="flex justify-between items-center mb-3">
              <h4 className="heading mb-0">Receipt Preview</h4>
              <button className="btn-ghost" onClick={() => setReceiptViewUrl("")}>Close</button>
            </div>
            <iframe title="receipt" src={receiptViewUrl} className="w-full h-full rounded-lg border border-white/50" />
          </div>
        </div>
      )}
    </div>
  );
}