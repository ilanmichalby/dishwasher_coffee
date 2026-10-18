"use client";

import { useEffect, useState } from "react";

const card = { background: "#fff", borderRadius: 14, padding: 14, marginBottom: 10, boxShadow: "0 1px 2px rgba(0,0,0,.06)" };
const btn = { width: 48, height: 48, fontSize: 24, borderRadius: 12, border: "1px solid #d6d3d1", background: "#fafaf9" };

export default function Page() {
  const [code, setCode] = useState("");
  const [items, setItems] = useState(null);
  const [drafts, setDrafts] = useState({});
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");

  async function load(c = code) {
    setStatus("טוען…");
    const res = await fetch("/api/items", { headers: { "x-access-code": c } });
    if (res.status === 401) { setItems(null); setStatus("קוד שגוי"); return; }
    if (!res.ok) { setStatus("שגיאה בטעינה"); return; }
    const data = await res.json();
    setItems(data.items);
    setDrafts({});
    setStatus("");
    try { localStorage.setItem("code", c); } catch {}
  }

  useEffect(() => {
    let saved = "";
    try { saved = localStorage.getItem("code") || ""; } catch {}
    setCode(saved);
    load(saved);
  }, []);

  async function save(item) {
    const qty = drafts[item.id];
    setStatus(`שומר את ${item.name}…`);
    const res = await fetch("/api/items", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", "x-access-code": code },
      body: JSON.stringify({ id: item.id, qty }),
    });
    if (!res.ok) { setStatus("השמירה נכשלה"); return; }
    const saved = await res.json();
    setItems((list) => list.map((i) => (i.id === saved.id ? { ...i, qty: saved.qty } : i)));
    setDrafts(({ [item.id]: _, ...rest }) => rest);
    setStatus(`✓ נשמר: ${item.name} = ${saved.qty}`);
  }

  if (!items) {
    return (
      <main style={{ padding: 16, maxWidth: 480, margin: "0 auto" }}>
        <h1>מלאי מסגרות</h1>
        <form onSubmit={(e) => { e.preventDefault(); load(); }} style={card}>
          <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="קוד כניסה" type="password"
            style={{ width: "100%", boxSizing: "border-box", fontSize: 18, padding: 12, borderRadius: 10, border: "1px solid #d6d3d1" }} />
          <button style={{ ...btn, width: "100%", marginTop: 10, fontSize: 18 }}>כניסה</button>
        </form>
        <p>{status}</p>
      </main>
    );
  }

  const shown = items.filter((i) => String(i.name).includes(query.trim()));

  return (
    <main style={{ padding: 16, maxWidth: 480, margin: "0 auto" }}>
      <h1 style={{ marginTop: 4 }}>מלאי מסגרות</h1>
      <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="חיפוש…" type="search"
        style={{ width: "100%", boxSizing: "border-box", fontSize: 18, padding: 12, borderRadius: 12, border: "1px solid #d6d3d1", marginBottom: 12 }} />
      {status && <p style={{ position: "sticky", top: 0, background: "#fef3c7", padding: 8, borderRadius: 8 }}>{status}</p>}
      {shown.map((item) => {
        const value = drafts[item.id] ?? item.qty;
        const dirty = item.id in drafts && drafts[item.id] !== item.qty;
        const set = (v) => setDrafts((d) => ({ ...d, [item.id]: Math.max(0, v) }));
        return (
          <div key={item.id} style={card}>
            <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 10 }}>{item.name || "(ללא שם)"}</div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <button style={btn} onClick={() => set(value + 1)}>+</button>
              <input type="number" inputMode="numeric" min="0" value={value}
                onChange={(e) => set(Number(e.target.value) || 0)}
                style={{ width: 72, height: 48, fontSize: 22, textAlign: "center", borderRadius: 12, border: "1px solid #d6d3d1" }} />
              <button style={btn} onClick={() => set(value - 1)}>−</button>
              <button disabled={!dirty} onClick={() => save(item)}
                style={{ ...btn, flex: 1, fontSize: 18, background: dirty ? "#16a34a" : "#e7e5e4", color: dirty ? "#fff" : "#78716c", border: "none" }}>
                שמירה
              </button>
            </div>
          </div>
        );
      })}
    </main>
  );
}
