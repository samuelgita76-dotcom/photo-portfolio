import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";
import { afterEach, beforeEach, test } from "node:test";
import worker from "../src/index.js";

globalThis.crypto ??= webcrypto;

const siteOrigin = "https://samuelgita76-dotcom.github.io";
const env = {
  ADMIN_SECRET: "test-admin-secret",
  SITE_URL: `${siteOrigin}/photo-portfolio`,
};
const state = { links: [] };
const originalFetch = globalThis.fetch;

class FakeD1 {
  prepare(sql) {
    let values = [];
    return {
      bind(...boundValues) {
        values = boundValues;
        return this;
      },
      all: async () => {
        assert.match(sql, /SELECT id, created_at, expires_at, revoked_at FROM links/);
        return {
          results: state.links
            .slice()
            .sort((left, right) => right.created_at.localeCompare(left.created_at))
            .map((link) => ({ ...link })),
        };
      },
      first: async () => {
        if (sql.includes("token_hash = ?1")) {
          const link = state.links.find((candidate) => candidate.token_hash === values[0]);
          return link ? { expires_at: link.expires_at, revoked_at: link.revoked_at } : null;
        }
        if (sql.includes("WHERE id = ?1")) {
          return state.links.some((link) => link.id === values[0]) ? { id: values[0] } : null;
        }
        throw new Error(`Unexpected first query: ${sql}`);
      },
      run: async () => {
        if (sql.startsWith("INSERT INTO links")) {
          state.links.push({
            id: values[0],
            token_hash: values[1],
            created_at: values[2],
            expires_at: values[3],
            revoked_at: null,
          });
          return { meta: { changes: 1 } };
        }
        if (sql.startsWith("UPDATE links SET revoked_at")) {
          const link = state.links.find((candidate) => candidate.id === values[1] && !candidate.revoked_at);
          if (!link) {
            return { meta: { changes: 0 } };
          }
          link.revoked_at = values[0];
          return { meta: { changes: 1 } };
        }
        throw new Error(`Unexpected run query: ${sql}`);
      },
    };
  }
}

const testEnv = { ...env, LINKS_DB: new FakeD1() };

function adminRequest(path, { method = "GET", body, secret = env.ADMIN_SECRET, origin = siteOrigin } = {}) {
  const headers = { Origin: origin };
  if (secret) {
    headers.Authorization = `Bearer ${secret}`;
  }
  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
  }
  return new Request(`https://links.example${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

beforeEach(() => {
  state.links = [];
  globalThis.fetch = async (url) => {
    assert.equal(String(url), env.SITE_URL);
    return new Response(
      "<!doctype html><html><head><title>Portfolio</title></head><body><main>Published work</main></body></html>",
      { headers: { "Content-Type": "text/html" } },
    );
  };
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

test("creates opaque links, returns metadata without tokens, and serves valid share links", async () => {
  const createdResponse = await worker.fetch(
    adminRequest("/api/links", { method: "POST", body: { expiresInHours: 24 } }),
    testEnv,
  );
  assert.equal(createdResponse.status, 201);
  const created = await createdResponse.json();
  assert.match(created.token, /^[a-f0-9]{64}$/);
  assert.equal(Date.parse(created.expiresAt) > Date.now(), true);
  assert.equal(state.links[0].token_hash === created.token, false);

  const listedResponse = await worker.fetch(adminRequest("/api/links"), testEnv);
  const listed = await listedResponse.json();
  assert.equal(listed.links.length, 1);
  assert.equal("token" in listed.links[0], false);
  assert.equal(listedResponse.headers.get("Access-Control-Allow-Origin"), siteOrigin);

  const shareResponse = await worker.fetch(
    new Request(`https://links.example/s/${created.token}`),
    testEnv,
  );
  assert.equal(shareResponse.status, 200);
  assert.match(await shareResponse.text(), /<base href="https:\/\/samuelgita76-dotcom\.github\.io\/photo-portfolio\/">/);
  assert.match(shareResponse.headers.get("Cache-Control"), /no-store/);
});

test("revokes a link immediately and rejects it after expiry", async () => {
  const createdResponse = await worker.fetch(
    adminRequest("/api/links", { method: "POST", body: { expiresInHours: 1 } }),
    testEnv,
  );
  const created = await createdResponse.json();
  const revokeResponse = await worker.fetch(
    adminRequest(`/api/links/${created.id}`, { method: "DELETE" }),
    testEnv,
  );
  assert.equal(revokeResponse.status, 200);

  const revokedResponse = await worker.fetch(
    new Request(`https://links.example/s/${created.token}`),
    testEnv,
  );
  assert.equal(revokedResponse.status, 410);

  state.links[0].revoked_at = null;
  state.links[0].expires_at = new Date(Date.now() - 1000).toISOString();
  const expiredResponse = await worker.fetch(
    new Request(`https://links.example/s/${created.token}`),
    testEnv,
  );
  assert.equal(expiredResponse.status, 410);
});

test("rejects invalid expiry, wrong admin secret, and unapproved origins", async () => {
  const invalidExpiry = await worker.fetch(
    adminRequest("/api/links", { method: "POST", body: { expiresInHours: 0 } }),
    testEnv,
  );
  assert.equal(invalidExpiry.status, 400);

  const unauthorized = await worker.fetch(
    adminRequest("/api/links", { secret: "incorrect" }),
    testEnv,
  );
  assert.equal(unauthorized.status, 401);

  const forbidden = await worker.fetch(
    adminRequest("/api/links", { origin: "https://attacker.example" }),
    testEnv,
  );
  assert.equal(forbidden.status, 403);
  assert.equal(state.links.length, 0);
});
