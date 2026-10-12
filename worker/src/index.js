const JSON_HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
};

function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...JSON_HEADERS, ...extraHeaders },
  });
}

function apiCorsHeaders(request, env) {
  const requestOrigin = request.headers.get("Origin");
  const allowedOrigin = new URL(env.SITE_URL).origin;
  if (requestOrigin !== allowedOrigin) {
    return null;
  }
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  };
}

async function sha256(value) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function isAuthorized(request, env) {
  const authorization = request.headers.get("Authorization") || "";
  const provided = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  if (!provided || !env.ADMIN_SECRET) {
    return false;
  }

  const [providedHash, expectedHash] = await Promise.all([
    sha256(provided),
    sha256(env.ADMIN_SECRET),
  ]);
  let difference = 0;
  for (let index = 0; index < expectedHash.length; index += 1) {
    difference |= providedHash.charCodeAt(index) ^ expectedHash.charCodeAt(index);
  }
  return difference === 0;
}

function makeToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function handleAdminApi(request, env, url, corsHeaders) {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (!await isAuthorized(request, env)) {
    return json({ error: "Unauthorized. Check the admin secret." }, 401, corsHeaders);
  }

  if (url.pathname === "/api/links" && request.method === "GET") {
    const { results } = await env.LINKS_DB.prepare(
      "SELECT id, created_at, expires_at, revoked_at FROM links ORDER BY created_at DESC",
    ).all();
    return json({
      links: results.map((link) => ({
        id: link.id,
        createdAt: link.created_at,
        expiresAt: link.expires_at,
        revokedAt: link.revoked_at,
      })),
    }, 200, corsHeaders);
  }

  if (url.pathname === "/api/links" && request.method === "POST") {
    let body;
    try {
      body = await request.json();
    } catch (error) {
      return json({ error: "Send a valid JSON request." }, 400, corsHeaders);
    }

    const expiresInHours = Number(body?.expiresInHours);
    if (!Number.isInteger(expiresInHours) || expiresInHours < 1 || expiresInHours > 8760) {
      return json({ error: "Expiry must be from 1 hour through 8760 hours." }, 400, corsHeaders);
    }

    const token = makeToken();
    const id = crypto.randomUUID();
    const createdAt = new Date().toISOString();
    const expiresAt = new Date(Date.now() + expiresInHours * 60 * 60 * 1000).toISOString();
    await env.LINKS_DB.prepare(
      "INSERT INTO links (id, token_hash, created_at, expires_at) VALUES (?1, ?2, ?3, ?4)",
    ).bind(id, await sha256(token), createdAt, expiresAt).run();

    return json({ id, token, createdAt, expiresAt }, 201, corsHeaders);
  }

  const revokeMatch = url.pathname.match(/^\/api\/links\/([0-9a-f-]{36})$/i);
  if (revokeMatch && request.method === "DELETE") {
    const result = await env.LINKS_DB.prepare(
      "UPDATE links SET revoked_at = ?1 WHERE id = ?2 AND revoked_at IS NULL",
    ).bind(new Date().toISOString(), revokeMatch[1]).run();
    if (!result.meta.changes) {
      const existing = await env.LINKS_DB.prepare(
        "SELECT id FROM links WHERE id = ?1",
      ).bind(revokeMatch[1]).first();
      if (!existing) {
        return json({ error: "This link was not found." }, 404, corsHeaders);
      }
    }
    return json({ revoked: true }, 200, corsHeaders);
  }

  return json({ error: "API route not found." }, 404, corsHeaders);
}

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;",
  })[character]);
}

function expiredPage() {
  return new Response(
    "<!doctype html><html lang=\"en\"><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><meta name=\"robots\" content=\"noindex,nofollow\"><title>Link unavailable</title><style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#f3f1ec;color:#24231f;font:16px/1.6 Arial,sans-serif}.card{max-width:440px;margin:24px;padding:42px;border:1px solid #d9d6ce}h1{font:500 clamp(38px,9vw,60px)/1 Georgia,serif;letter-spacing:-.05em}p{color:#69665f}</style><main class=\"card\"><p>PORTFOLIO ACCESS</p><h1>This link is no longer available.</h1><p>It may have expired or been revoked by the photographer.</p></main></html>",
    {
      status: 410,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
        "X-Robots-Tag": "noindex, nofollow",
      },
    },
  );
}

async function handleShare(request, env, token) {
  if (!/^[a-f0-9]{64}$/i.test(token)) {
    return expiredPage();
  }
  const link = await env.LINKS_DB.prepare(
    "SELECT expires_at, revoked_at FROM links WHERE token_hash = ?1",
  ).bind(await sha256(token)).first();
  if (!link || link.revoked_at || Date.now() >= Date.parse(link.expires_at)) {
    return expiredPage();
  }

  const siteUrl = env.SITE_URL.replace(/\/+$/, "");
  const portfolio = await fetch(siteUrl, { redirect: "follow" });
  if (!portfolio.ok) {
    console.error("Could not fetch the published portfolio:", portfolio.status);
    return new Response("The published portfolio is temporarily unavailable.", {
      status: 502,
      headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
    });
  }

  let html = await portfolio.text();
  if (!/<head(?:\s[^>]*)?>/i.test(html) || !/<body(?:\s[^>]*)?>/i.test(html)) {
    console.error("The published portfolio response is missing its head or body element.");
    return new Response("The published portfolio could not be displayed.", {
      status: 502,
      headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
    });
  }

  const baseUrl = escapeHtml(`${siteUrl}/`);
  const expiryLabel = escapeHtml(new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(new Date(link.expires_at)));
  const base = `<base href="${baseUrl}"><meta name="robots" content="noindex,nofollow">`;
  const notice = `<aside class="timed-share-notice">TEMPORARY PORTFOLIO LINK · EXPIRES ${expiryLabel} UTC</aside><style>.timed-share-notice{position:fixed;z-index:9999;right:16px;bottom:16px;padding:11px 14px;background:#24231f;color:#fff;font:9px/1.5 monospace;letter-spacing:.07em;box-shadow:0 4px 20px #0003}@media(max-width:600px){.timed-share-notice{right:8px;bottom:8px;left:8px;text-align:center}}</style>`;
  html = html.replace(/<head(?:\s[^>]*)?>/i, (match) => `${match}${base}`);
  html = html.replace(/<body(?:\s[^>]*)?>/i, (match) => `${match}${notice}`);

  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store, max-age=0",
      "X-Content-Type-Options": "nosniff",
      "X-Robots-Tag": "noindex, nofollow",
      "Referrer-Policy": "no-referrer",
    },
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const isApi = url.pathname === "/api/links" || url.pathname.startsWith("/api/links/");
    try {
      if (isApi) {
        const corsHeaders = apiCorsHeaders(request, env);
        if (!corsHeaders) {
          return json({ error: "This origin is not allowed." }, 403);
        }
        return await handleAdminApi(request, env, url, corsHeaders);
      }
      if (request.method === "GET" && url.pathname.startsWith("/s/")) {
        return await handleShare(request, env, url.pathname.slice(3));
      }
      return new Response("Not found.", {
        status: 404,
        headers: { "Content-Type": "text/plain; charset=utf-8", "X-Content-Type-Options": "nosniff" },
      });
    } catch (error) {
      console.error("Link service request failed:", error);
      return isApi
        ? json({ error: "The link service could not complete the request. Try again." }, 500)
        : new Response("The link service could not complete the request. Try again.", {
          status: 500,
          headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
        });
    }
  },
};
