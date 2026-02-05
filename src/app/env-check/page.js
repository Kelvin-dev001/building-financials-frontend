export const dynamic = "force-dynamic";

export default function EnvCheck() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "MISSING";
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "MISSING";
  return (
    <main style={{ padding: "2rem", fontFamily: "monospace" }}>
      <h1>Env Check</h1>
      <pre>{JSON.stringify({
        NEXT_PUBLIC_SUPABASE_URL: url,
        NEXT_PUBLIC_SUPABASE_ANON_KEY_last6: anon !== "MISSING" ? anon.slice(-6) : "MISSING",
        NEXT_PUBLIC_API_BASE: process.env.NEXT_PUBLIC_API_BASE || "MISSING"
      }, null, 2)}</pre>
      <p>Anon key is public; showing last 6 chars is safe.</p>
    </main>
  );
}