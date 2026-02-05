"use client";

import { useState } from "react";
import { supabase } from "../../../lib/supabaseClient";

export default function ResetPage() {
  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;

  const handleReset = async (e) => {
    e.preventDefault();
    setMsg("");
    setErr("");
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${siteUrl}/auth/update`
    });
    if (error) setErr(error.message);
    else setMsg("Check your email for the reset link.");
  };

  return (
    <main style={{ padding: "2rem" }}>
      <h1>Reset Password</h1>
      <form onSubmit={handleReset} style={{ display: "grid", gap: "0.5rem", maxWidth: 320 }}>
        <input
          type="email"
          placeholder="your email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <button type="submit">Send reset link</button>
      </form>
      {msg && <p style={{ color: "green" }}>{msg}</p>}
      {err && <p style={{ color: "red" }}>{err}</p>}
    </main>
  );
}