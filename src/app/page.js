"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

export default function Home() {
  const apiBase = process.env.NEXT_PUBLIC_API_BASE || "https://building-financials-backend.onrender.com";

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
  const [contribMsg, setContribMsg] = useState("");

  const [receiptContributionId, setReceiptContributionId] = useState("");
  const [receiptKes, setReceiptKes] = useState("");
  const [receiptFx, setReceiptFx] = useState("");
  const [receiptMsg, setReceiptMsg] = useState("");

  const [expenseAmount, setExpenseAmount] = useState("");
  const [expenseCategory, setExpenseCategory] = useState("materials");
  const [expenseDate, setExpenseDate] = useState("");
  const [expenseDesc, setExpenseDesc] = useState("");
  const [expenseReceiptUrl, setExpenseReceiptUrl] = useState("");
  const [expenseMsg, setExpenseMsg] = useState("");

  const [approveReceiptId, setApproveReceiptId] = useState("");
  const [approveMsg, setApproveMsg] = useState("");

  // Helpers
  const authHeaders = () =>
    session?.access_token
      ? { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" }
      : { "Content-Type": "application/json" };

  // Check backend health
  useEffect(() => {
    const check = async () => {
      try {
        const res = await fetch(`${apiBase}/health`);
        const json = await res.json();
        setApiStatus(json.ok ? "API OK" : `API error: ${json.error}`);
      } catch (err) {
        setApiStatus(`API unreachable: ${err.message}`);
      }
    };
    check();
  }, [apiBase]);

  // Session listener
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session ?? null));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, sess) => {
      setSession(sess);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  // Fetch /api/me
  useEffect(() => {
    const fetchMe = async () => {
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
    };
    fetchMe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  // Auth actions
  const handleLogin = async (e) => {
    e.preventDefault();
    setAuthError("");
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setAuthError(error.message);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setMe(null);
  };

  // Investor: create contribution
  const submitContribution = async (e) => {
    e.preventDefault();
    setContribMsg("");
    const res = await fetch(`${apiBase}/api/contributions`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ eur_amount: Number(contribAmount), note: contribNote })
    });
    const json = await res.json();
    if (res.ok) {
      setContribMsg("Contribution created (pending).");
      setContribAmount("");
      setContribNote("");
    } else setContribMsg(json.error || "Error");
  };

  // Developer: confirm receipt
  const submitReceipt = async (e) => {
    e.preventDefault();
    setReceiptMsg("");
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
      setReceiptMsg("Receipt logged (awaiting approval).");
      setReceiptContributionId("");
      setReceiptKes("");
      setReceiptFx("");
    } else setReceiptMsg(json.error || "Error");
  };

  // Developer: log expense
  const submitExpense = async (e) => {
    e.preventDefault();
    setExpenseMsg("");
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
      setExpenseMsg("Expense logged.");
      setExpenseAmount("");
      setExpenseCategory("materials");
      setExpenseDate("");
      setExpenseDesc("");
      setExpenseReceiptUrl("");
    } else setExpenseMsg(json.error || "Error");
  };

  // Admin: approve receipt
  const submitApproveReceipt = async (e) => {
    e.preventDefault();
    setApproveMsg("");
    const res = await fetch(`${apiBase}/api/admin/receipts/${approveReceiptId}/approve`, {
      method: "POST",
      headers: authHeaders()
    });
    const json = await res.json();
    if (res.ok) {
      setApproveMsg("Receipt approved.");
      setApproveReceiptId("");
    } else setApproveMsg(json.error || "Error");
  };

  const role = me?.role;

  return (
    <main style={{ padding: "2rem", maxWidth: 960, margin: "0 auto", fontFamily: "Inter, sans-serif" }}>
      <h1>Building Project Financial Management</h1>
      <p>Backend status: {apiStatus}</p>

      <section style={{ marginTop: "1.5rem" }}>
        <h2>Auth</h2>
        {session ? (
          <>
            <p>Signed in as: {session.user.email}</p>
            <button onClick={handleLogout}>Logout</button>
          </>
        ) : (
          <form onSubmit={handleLogin} style={{ display: "grid", gap: "0.5rem", maxWidth: 320 }}>
            <input type="email" placeholder="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            <input
              type="password"
              placeholder="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <button type="submit">Sign In</button>
            {authError && <span style={{ color: "red" }}>{authError}</span>}
          </form>
        )}
        <p style={{ marginTop: "0.5rem" }}>
          Forgot password? <a href="/auth/reset">Reset here</a>
        </p>
      </section>

      <section style={{ marginTop: "1.5rem" }}>
        <h2>Who am I?</h2>
        {me ? <pre>{JSON.stringify(me, null, 2)}</pre> : <p>Not loaded.</p>}
      </section>

      {/* Investor form */}
      {(role === "investor" || role === "admin") && (
        <section style={{ marginTop: "1.5rem" }}>
          <h2>Investor: Create Contribution (EUR)</h2>
          <form onSubmit={submitContribution} style={{ display: "grid", gap: "0.5rem", maxWidth: 360 }}>
            <input
              type="number"
              step="0.01"
              placeholder="EUR amount"
              value={contribAmount}
              onChange={(e) => setContribAmount(e.target.value)}
              required
            />
            <textarea
              placeholder="note (optional)"
              value={contribNote}
              onChange={(e) => setContribNote(e.target.value)}
            />
            <button type="submit">Create Contribution</button>
            {contribMsg && <span>{contribMsg}</span>}
          </form>
        </section>
      )}

      {/* Developer forms */}
      {(role === "developer" || role === "admin") && (
        <>
          <section style={{ marginTop: "1.5rem" }}>
            <h2>Developer: Confirm Receipt (KES)</h2>
            <form onSubmit={submitReceipt} style={{ display: "grid", gap: "0.5rem", maxWidth: 360 }}>
              <input
                type="text"
                placeholder="contribution_id"
                value={receiptContributionId}
                onChange={(e) => setReceiptContributionId(e.target.value)}
                required
              />
              <input
                type="number"
                step="0.01"
                placeholder="KES received"
                value={receiptKes}
                onChange={(e) => setReceiptKes(e.target.value)}
                required
              />
              <input
                type="number"
                step="0.000001"
                placeholder="FX rate (optional)"
                value={receiptFx}
                onChange={(e) => setReceiptFx(e.target.value)}
              />
              <button type="submit">Log Receipt</button>
              {receiptMsg && <span>{receiptMsg}</span>}
            </form>
          </section>

          <section style={{ marginTop: "1.5rem" }}>
            <h2>Developer: Log Expense</h2>
            <form onSubmit={submitExpense} style={{ display: "grid", gap: "0.5rem", maxWidth: 360 }}>
              <input
                type="number"
                step="0.01"
                placeholder="Amount (KES)"
                value={expenseAmount}
                onChange={(e) => setExpenseAmount(e.target.value)}
                required
              />
              <select value={expenseCategory} onChange={(e) => setExpenseCategory(e.target.value)}>
                <option value="materials">materials</option>
                <option value="labour">labour</option>
                <option value="other">other</option>
              </select>
              <input
                type="date"
                value={expenseDate}
                onChange={(e) => setExpenseDate(e.target.value)}
                required
              />
              <textarea
                placeholder="Description"
                value={expenseDesc}
                onChange={(e) => setExpenseDesc(e.target.value)}
              />
              <input
                type="url"
                placeholder="Receipt URL (optional)"
                value={expenseReceiptUrl}
                onChange={(e) => setExpenseReceiptUrl(e.target.value)}
              />
              <button type="submit">Log Expense</button>
              {expenseMsg && <span>{expenseMsg}</span>}
            </form>
          </section>
        </>
      )}

      {/* Admin actions */}
      {role === "admin" && (
        <section style={{ marginTop: "1.5rem" }}>
          <h2>Admin: Approve Receipt</h2>
          <form onSubmit={submitApproveReceipt} style={{ display: "grid", gap: "0.5rem", maxWidth: 360 }}>
            <input
              type="text"
              placeholder="receipt_id"
              value={approveReceiptId}
              onChange={(e) => setApproveReceiptId(e.target.value)}
              required
            />
            <button type="submit">Approve Receipt</button>
            {approveMsg && <span>{approveMsg}</span>}
          </form>
        </section>
      )}
    </main>
  );
}