"use client";

import { useEffect, useState } from "react";

export default function Home() {
  const [apiStatus, setApiStatus] = useState("Checking...");
  const apiBase = process.env.NEXT_PUBLIC_API_BASE || "https://building-financials-backend.onrender.com";

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

  return (
    <main style={{ fontFamily: "sans-serif", padding: "2rem" }}>
      <h1>Building Project Financial Management</h1>
      <p>Live status: {apiStatus}</p>
    </main>
  );
}