"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";

export default function UpdatePasswordPage() {
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [ready, setReady] = useState(false);

  // Ensure we have a session (the reset link includes an access token in the URL hash)
  useEffect(() => {
    const init = async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        setErr("No active password reset session. Revisit the reset link from your email.");
      }
      setReady(true);
    };
    init();
  }, []);

  const handleUpdate = async (e) => {
    e.preventDefault();
    setMsg("");
    setErr("");
    const { error } = await supabase.auth.updateUser({ password });
    if (error) setErr(error.message);
    else setMsg("Password updated. You can now log in with the new password.");
  };

  if (!ready) return <main style={{ padding: "2rem" }}>Checking session...</main>;

  return (
    <main style={{ padding: "2rem" }}>
      <h1>Set New Password</h1>
      <form onSubmit={handleUpdate} style={{ display: "grid", gap: "0.5rem", maxWidth: 320 }}>
        <input
          type="password"
          placeholder="new password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <button type="submit">Update password</button>
      </form>
      {msg && <p style={{ color: "green" }}>{msg}</p>}
      {err && <p style={{ color: "red" }}>{err}</p>}
    </main>
  );
}