import assert from "node:assert/strict";
import worker from "../src/worker.js";
import { MockDB } from "./mock-db.js";

function makeEnv(seed = [], token = "tok123") {
  const db = new MockDB(seed);
  const assets = {
    async fetch(request) {
      const url = new URL(request.url);
      if (url.pathname === "/404.html") return new Response("<h1>404</h1>", { status: 200, headers: { "content-type": "text/html" } });
      if (url.pathname === "/" || url.pathname === "/index.html") return new Response("<h1>index</h1>", { status: 200, headers: { "content-type": "text/html" } });
      return new Response("asset", { status: 200 });
    },
  };
  return { DB: db, ADMIN_TOKEN: token, ASSETS: assets, db };
}

async function fetchJson(response) {
  return JSON.parse(await response.text());
}

const now = "2026-06-23T00:00:00Z";
const seed = [{ code: "meeting", title: "Meeting", url: "https://example.com", owner: "office", note: "", enabled: true, click_count: 0, last_clicked_at: null, created_at: now, updated_at: now }];
const env = makeEnv(seed);
const authToken = "tok123";
const authHeader = { authorization: ['Bearer', authToken].join(' ') };

// unauthorized
let res = await worker.fetch(new Request("https://example.com/api/links"), env);
assert.equal(res.status, 401);

// list links
res = await worker.fetch(new Request("https://example.com/api/links", { headers: authHeader }), env);
assert.equal(res.status, 200);
let body = await fetchJson(res);
assert.equal(body.links.length, 1);

// create link
res = await worker.fetch(new Request("https://example.com/api/links", {
  method: "POST",
  headers: { ...authHeader, "content-type": "application/json" },
  body: JSON.stringify({ code: "news2026", title: "News", url: "https://example.org", owner: "press", note: "demo", enabled: true }),
}), env);
assert.equal(res.status, 201);
body = await fetchJson(res);
assert.equal(body.link.code, "news2026");

// redirect and click counting
res = await worker.fetch(new Request("https://example.com/meeting"), env);
assert.equal(res.status, 302);
assert.equal(res.headers.get("location"), "https://example.com/");
assert.equal(env.db.links.get("meeting").click_count, 1);

// api stats
res = await worker.fetch(new Request("https://example.com/api/stats", { headers: authHeader }), env);
assert.equal(res.status, 200);
body = await fetchJson(res);
assert.equal(body.summary.total_links, 2);
assert.equal(body.summary.total_clicks, 1);

console.log("All worker tests passed.");
