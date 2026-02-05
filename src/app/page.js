"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "../lib/supabaseClient";

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

function AdminLockDeleteForm({ apiBase, session, toast }) {
  const [table, setTable] = useState("contributions");
  const [rowId, setRowId] = useState("");
  const doCall = async (path) => {
    const res = await fetch(`${apiBase}${path}`, {
      method: "POST",
      headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}
    });
    const json = await res.json();
    if (res.ok) toast("Done");
    else toast(json.error || "Error", "error");
  };
  return (
    <div className="glass p-4 flex flex-col gap-2 max-w-md">
      <select className="input" value={table} onChange={(e) => setTable(e.target.value)}>
        <option value="contributions">contributions</option>
        <option value="receipts">receipts</option>
        <option value="expenses">expenses</option>
        <option value="expense_comments">expense_comments</option>
      </select>
      <input
        className="input"
        type="text"
        placeholder="row id"
        value={rowId}
        onChange={(e) => setRowId(e.target.value)}
      />
      <div className="flex gap-2 flex-wrap">
        <button className="btn-primary" type="button" onClick={() => doCall(`/api/admin/${table}/${rowId}/lock`)}>
          Lock
        </button>
        <button className="btn-ghost" type="button" onClick={() => doCall(`/api/admin/${table}/${rowId}/soft-delete`)}>
          Soft-delete
        </button>
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

  // Forms state
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
  const [flagExpenseId, setFlagExpenseId] = useState("");
  const [commentExpenseId, setCommentExpenseId] = useState("");
  const [commentText, setCommentText] = useState("");
  const [uploadFile, setUploadFile] = useState(null);

  // Lists
  const [contribs, setContribs] = useState([]);
  const [receipts, setReceipts] = useState([]);
  const [expenses, setExpenses] = useState([]);

  // Reports
  const [report, setReport] = useState(null);

  const authHeaders = () =>
    session?.access_token
      ? { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" }
      : { "Content-Type": "application/json" };

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
      const res = await fetch(`${apiBase}/api/me`, { headers: authHeaders() });
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
      const [cRes, rRes, eRes] = await Promise.all([
        fetch(`${apiBase}/api/contributions`, { headers: authHeaders() }),
        fetch(`${apiBase}/api/receipts`, { headers: authHeaders() }),
        fetch(`${apiBase}/api/expenses`, { headers: authHeaders() })
      ]);
      const cJson = await cRes.json();
      const rJson = await rRes.json();
      const eJson = await eRes.json();
      if (cRes.ok) setContribs(cJson || []);
      if (rRes.ok) setReceipts(rJson || []);
      if (eRes.ok) setExpenses(eJson || []);
    } catch (err) {
      addToast(err.message, "error");
    }
  }, [apiBase, session, addToast]);

  const fetchReport = useCallback(async () => {
    if (!session?.access_token) return;
    try {
      const res = await fetch(`${apiBase}/api/reports/summary`, { headers: authHeaders() });
      const json = await res.json();
      if (res.ok) setReport(json);
    } catch (err) {
      addToast(err.message, "error");
    }
  }, [apiBase, session, addToast]);

  useEffect(() => {
    fetchMe();
    fetchLists();
    fetchReport();
  }, [fetchMe, fetchLists, fetchReport]);

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

  // Investor: contribution
  const submitContribution = async (e) => {
    e.preventDefault();
    const res = await fetch(`${apiBase}/api/contributions`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ eur_amount: Number(contribAmount), note: contribNote })
    });
    const json = await res.json();
    if (res.ok) {
      addToast("Contribution created");
      setContribAmount("");
      setContribNote("");
      fetchLists();
      fetchReport();
    } else addToast(json.error || "Error", "error");
  };

  // Developer: receipt
  const submitReceipt = async (e) => {
    e.preventDefault();
    const res = await fetch(`${apiBase}/api/receipts`, {
      method: "POST",
      headers: authHeaders(),
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
      fetchLists();
      fetchReport();
    } else addToast(json.error || "Error", "error");
  };

  // Developer: expense
  const submitExpense = async (e) => {
    e.preventDefault();
    const res = await fetch(`${apiBase}/api/expenses`, {
      method: "POST",
      headers: authHeaders(),
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
      fetchLists();
      fetchReport();
    } else addToast(json.error || "Error", "error");
  };

  // Admin: approve receipt
  const submitApproveReceipt = async (e) => {
    e.preventDefault();
    const res = await fetch(`${apiBase}/api/admin/receipts/${approveReceiptId}/approve`, {
      method: "POST",
      headers: authHeaders()
    });
    const json = await res.json();
    if (res.ok) {
      addToast("Receipt approved");
      setApproveReceiptId("");
      fetchLists();
      fetchReport();
    } else addToast(json.error || "Error", "error");
  };

  // Flag
  const submitFlag = async (e) => {
    e.preventDefault();
    const res = await fetch(`${apiBase}/api/expenses/${flagExpenseId}/flag`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ flagged: true })
    });
    const json = await res.json();
    if (res.ok) {
      addToast("Expense flagged");
      setFlagExpenseId("");
      fetchLists();
      fetchReport();
    } else addToast(json.error || "Error", "error");
  };

  // Comment
  const submitComment = async (e) => {
    e.preventDefault();
    const res = await fetch(`${apiBase}/api/expenses/${commentExpenseId}/comments`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ comment: commentText })
    });
    const json = await res.json();
    if (res.ok) {
      addToast("Comment added");
      setCommentExpenseId("");
      setCommentText("");
    } else addToast(json.error || "Error", "error");
  };

  // Upload receipt
  const submitUpload = async (e) => {
    e.preventDefault();
    if (!uploadFile) {
      addToast("Select a file", "error");
      return;
    }
    const formData = new FormData();
    formData.append("file", uploadFile);
    const res = await fetch(`${apiBase}/api/uploads/receipt`, {
      method: "POST",
      headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {},
      body: formData
    });
    const json = await res.json();
    if (res.ok) {
      addToast("Uploaded");
      setUploadFile(null);
    } else {
      addToast(json.error || "Upload error", "error");
    }
  };

  // Exports
  const downloadFile = async (path, filename, mime) => {
    const res = await fetch(`${apiBase}${path}`, { headers: authHeaders() });
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

  const role = me?.role;

  // Mobile sticky primary actions (per role)
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
          <div>
            <p className="text-sm uppercase tracking-[0.2em] text-ink/60">Building Project Financials</p>
            <h1 className="text-3xl font-bold text-ink">Control Center</h1>
            <p className="subtle">Kenyan project · Investors · Developers · Admin</p>
          </div>
          <div className="flex flex-col items-start gap-2 md:items-end w-full sm:w-auto">
            <span className="badge">{apiStatus}</span>
            {session ? (
              <div className="text-right w-full sm:w-auto">
                <p className="text-sm text-ink/80 break-words">{session.user.email}</p>
                <button className="btn-ghost mt-2 w-full sm:w-auto" onClick={handleLogout}>
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
                <p className="text-xs text-ink/60">
                  Forgot password? <a className="text-ink underline" href="/auth/reset">Reset here</a>
                </p>
              </form>
            )}
          </div>
        </div>
      </header>

      {/* Session & Reports */}
      <section className="section">
        <div className="grid gap-6 lg:grid-cols-2">
          <div>
            <h2 className="heading">Session & Role</h2>
            {me ? (
              <pre className="bg-white/80 rounded-xl p-4 border border-white/60 text-sm overflow-x-auto">
{JSON.stringify(me, null, 2)}
              </pre>
            ) : (
              <p className="subtle">Not loaded.</p>
            )}
          </div>
          <div>
            <h2 className="heading">Reports (Summary)</h2>
            {report ? (
              <div className="space-y-3 text-sm">
                <div className="glass p-3">
                  <div className="font-semibold">Balances</div>
                  <div>Total Received (KES): {report.balances?.total_received_kes ?? "-"}</div>
                  <div>Total Expenses (KES): {report.balances?.total_expenses_kes ?? "-"}</div>
                  <div>Balance (KES): {report.balances?.balance_kes ?? "-"}</div>
                </div>
                <div className="glass p-3">
                  <div className="font-semibold">Contributions by Investor</div>
                  <ul className="list-disc list-inside">
                    {(report.contributions_by_investor || []).map((c) => (
                      <li key={c.investor_id}>{(c.investor_name || c.investor_id)} — EUR {c.total_eur}</li>
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
              </div>
            ) : (
              <p className="subtle">No report data yet.</p>
            )}
          </div>
        </div>
      </section>

      {/* Lists */}
      <section className="grid gap-6 lg:grid-cols-3">
        <div className="section">
          <h3 className="heading">Contributions</h3>
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

      {/* Forms */}
      <div className="grid gap-6 lg:grid-cols-2">
        {(role === "investor" || role === "admin") && (
          <section className="section" id="contrib-form">
            <h3 className="heading">Investor: Create Contribution (EUR)</h3>
            <form onSubmit={submitContribution} className="space-y-3">
              <div>
                <label className="label">EUR amount</label>
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
          <h3 className="heading">Admin: Lock / Soft-delete</h3>
          <p className="subtle mb-2">Table: contributions | receipts | expenses | expense_comments</p>
          <AdminLockDeleteForm apiBase={apiBase} session={session} toast={addToast} />
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