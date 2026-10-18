const API = "https://api.airtable.com/v0";
const { AIRTABLE_TOKEN, AIRTABLE_BASE_ID, AIRTABLE_TABLE_ID, NAME_FIELD, QTY_FIELDS = "מלאי,להזמין", ACCESS_CODE } = process.env;
const FIELDS = QTY_FIELDS.split(",").map((f) => f.trim()).filter(Boolean);

function authorized(request) {
  return !ACCESS_CODE || request.headers.get("x-access-code") === ACCESS_CODE;
}

async function airtable(path, init = {}) {
  const res = await fetch(`${API}/${AIRTABLE_BASE_ID}/${encodeURIComponent(AIRTABLE_TABLE_ID)}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${AIRTABLE_TOKEN}`, "Content-Type": "application/json" },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Airtable ${res.status}: ${await res.text()}`);
  return res.json();
}

// Without NAME_FIELD, label each row with its first text value.
function displayName(fields) {
  if (NAME_FIELD) return fields[NAME_FIELD] ?? "";
  return Object.entries(fields).find(([k, v]) => !FIELDS.includes(k) && typeof v === "string")?.[1] ?? "";
}

const pick = (fields) => Object.fromEntries(FIELDS.map((f) => [f, fields[f] ?? 0]));

export async function GET(request) {
  if (!authorized(request)) return Response.json({ error: "unauthorized" }, { status: 401 });
  const items = [];
  let offset;
  do {
    const params = new URLSearchParams();
    if (NAME_FIELD) for (const f of [NAME_FIELD, ...FIELDS]) params.append("fields[]", f);
    if (offset) params.set("offset", offset);
    const data = await airtable(`?${params}`);
    for (const r of data.records) {
      items.push({ id: r.id, name: displayName(r.fields), values: pick(r.fields) });
    }
    offset = data.offset;
  } while (offset);
  items.sort((a, b) => String(a.name).localeCompare(String(b.name), "he"));
  return Response.json({ fields: FIELDS, items });
}

export async function PATCH(request) {
  if (!authorized(request)) return Response.json({ error: "unauthorized" }, { status: 401 });
  const { id, values } = await request.json();
  const entries = Object.entries(values ?? {});
  if (typeof id !== "string" || !entries.length || entries.some(([f, v]) => !FIELDS.includes(f) || !Number.isFinite(v) || v < 0)) {
    return Response.json({ error: "invalid input" }, { status: 400 });
  }
  const r = await airtable(`/${id}`, { method: "PATCH", body: JSON.stringify({ fields: values }) });
  return Response.json({ id: r.id, values: pick(r.fields) });
}
