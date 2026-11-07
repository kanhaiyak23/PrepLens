// Fires truly simultaneous requests at a running API and checks that the database defences hold.
// Usage (the token is a signed-in user's Supabase access token; an admin token is needed for the approve test):
//   API=http://localhost:4000 TOKEN=<access token> PUBLISHED_ID=<published post id> PENDING_ID=<pending post id> node scripts/concurrency-check.mjs
// It changes data on the project it points at: use it with test posts only.
const API = (process.env.API ?? "http://localhost:4000") + "/api/v1";
const { TOKEN, PUBLISHED_ID, PENDING_ID } = process.env;
if (!TOKEN || !PUBLISHED_ID) { console.error("Set TOKEN and PUBLISHED_ID (and PENDING_ID for the approve test)."); process.exit(1); }

const call = (method, path) => fetch(API + path, { method, headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" }, body: method === "POST" ? "{}" : undefined }).then(async (r) => ({ status: r.status, body: await r.json().catch(() => null) }));
const tally = (rs) => rs.reduce((a, r) => ({ ...a, [r.status]: (a[r.status] ?? 0) + 1 }), {});
let failed = 0;
const check = (name, ok, detail) => { console.log(`${ok ? "PASS" : "FAIL"}  ${name}  ${detail}`); if (!ok) failed++; };

// 1. 25 simultaneous votes by one user on one post: the primary key must leave exactly one vote (ADR-07).
const puts = await Promise.all(Array.from({ length: 25 }, () => call("PUT", `/experiences/${PUBLISHED_ID}/vote`)));
const counts = new Set(puts.filter((r) => r.status === 200).map((r) => r.body.data.upvoteCount));
check("25 parallel votes", puts.every((r) => r.status === 200) && counts.has(1) && Math.max(...counts) === 1, JSON.stringify(tally(puts)));
await Promise.all(Array.from({ length: 25 }, () => call("DELETE", `/experiences/${PUBLISHED_ID}/vote`)));

// 2. 12 simultaneous approvals of one pending post: exactly one wins, the rest get a conflict (compare-and-set).
if (PENDING_ID) {
  const approvals = await Promise.all(Array.from({ length: 12 }, () => call("POST", `/admin/experiences/${PENDING_ID}/approve`)));
  const t = tally(approvals);
  check("12 parallel approvals", t[200] === 1 && t[409] === 11, JSON.stringify(t));
}

// 3. The limiter must never admit more than its limit in one window, however many requests arrive together (ADR-11).
const burst = await Promise.all(Array.from({ length: 80 }, () => call("PUT", `/experiences/${PUBLISHED_ID}/bookmark`)));
const t3 = tally(burst);
check("80 parallel interactions against a limit of 60/min", (t3[200] ?? 0) <= 60 && (t3[500] ?? 0) === 0, JSON.stringify(t3));
await call("DELETE", `/experiences/${PUBLISHED_ID}/bookmark`);

console.log(failed ? `\n${failed} check(s) failed` : "\nAll concurrency checks passed");
process.exit(failed ? 1 : 0);
