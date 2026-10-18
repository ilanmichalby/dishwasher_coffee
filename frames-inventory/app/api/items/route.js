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

// The row label is NAME_FIELD, else the table's primary field (needs the schema.bases:read scope).
let nameField = NAME_FIELD;
async function resolveNameField() {
  if (nameField) return nameField;
  const res = await fetch(`${API}/meta/bases/${AIRTABLE_BASE_ID}/tables`, {
    headers: { Authorization: `Bearer ${AIRTABLE_TOKEN}` },
    cache: "no-store",
  });
  if (!res.ok) return null;
  const { tables } = await res.json();
  const table = tables.find((t) => t.id === AIRTABLE_TABLE_ID || t.name === AIRTABLE_TABLE_ID);
  nameField = table?.fields.find((f) => f.id === table.primaryFieldId)?.name ?? null;
  return nameField;
}

// Fallback when the primary field is unknown: the row's first text value.
function displayName(fields, name) {
  if (name) return fields[name] ?? "";
  return Object.entries(fields).find(([k, v]) => !FIELDS.includes(k) && typeof v === "string")?.[1] ?? "";
}

const pick = (fields) => Object.fromEntries(FIELDS.map((f) => [f, fields[f] ?? 0]));

export async function GET(request) {
  if (!authorized(request)) return Response.json({ error: "unauthorized" }, { status: 401 });
  const name = await resolveNameField();
  const items = [];
  let offset;
  do {
    const params = new URLSearchParams();
    if (name) for (const f of [name, ...FIELDS]) params.append("fields[]", f);
    if (offset) params.set("offset", offset);
    const data = await airtable(`?${params}`);
    for (const r of data.records) {
      items.push({ id: r.id, name: displayName(r.fields, name), values: pick(r.fields) });
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
