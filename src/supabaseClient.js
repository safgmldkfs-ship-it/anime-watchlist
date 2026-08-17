const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseKey);

function headers() {
  if (!isSupabaseConfigured) throw new Error("尚未設定 Supabase");
  return {
    apikey: supabaseKey,
    Authorization: `Bearer ${supabaseKey}`,
    "Content-Type": "application/json",
  };
}

export async function createShareRow(shareCode, payload) {
  const res = await fetch(`${supabaseUrl}/rest/v1/watchlist_shares`, {
    method: "POST",
    headers: { ...headers(), Prefer: "return=minimal" },
    body: JSON.stringify({ share_code: shareCode, payload }),
  });
  if (!res.ok) throw new Error(await res.text());
}

export async function getShareRow(shareCode) {
  const res = await fetch(
    `${supabaseUrl}/rest/v1/watchlist_shares?select=payload&share_code=eq.${encodeURIComponent(shareCode)}&limit=1`,
    { headers: headers() }
  );
  if (!res.ok) throw new Error(await res.text());
  const rows = await res.json();
  return rows[0] || null;
}
