const http = require("node:http");
const fs = require("node:fs");
const fsp = require("node:fs/promises");
const path = require("node:path");
const https = require("node:https");

const PORT = Number.parseInt(process.env.PORT || "8000", 10) || 8000;
const ROOT_DIR = path.join(__dirname, "website");
const STATIC_BUST_VERSION = "20260408_3";

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".otf": "font/otf",
  ".map": "application/json; charset=utf-8"
};

const isPathTraversal = (p) => {
  const normalized = path.posix.normalize(p).replace(/^(\.\.(\/|\\|$))+/, "");
  return normalized.includes("..");
};

const toLocalPath = (urlPathname) => {
  const decoded = decodeURIComponent(urlPathname || "/");
  const posixPath = decoded.replace(/\\/g, "/");
  if (isPathTraversal(posixPath)) return null;
  const withoutLeading = posixPath.replace(/^\/+/, "");
  return path.join(ROOT_DIR, withoutLeading);
};

const existsFile = async (p) => {
  try {
    const st = await fsp.stat(p);
    return st.isFile();
  } catch {
    return false;
  }
};

const resolveRequestToFile = async (reqUrl) => {
  const u = new URL(reqUrl, `http://127.0.0.1:${PORT}`);
  let pathname = u.pathname || "/";

  if (pathname === "/product" || pathname === "/product.html") pathname = "/products/product.html";

  if (pathname === "/") pathname = "/index.html";
  if (pathname.endsWith("/")) pathname = pathname + "index.html";

  const ext = path.posix.extname(pathname);

  if (!ext) {
    const asHtml = pathname + ".html";
    const asHtmlFs = toLocalPath(asHtml);
    if (asHtmlFs && (await existsFile(asHtmlFs))) return asHtmlFs;
  }

  const fsPath = toLocalPath(pathname);
  if (fsPath && (await existsFile(fsPath))) return fsPath;

  return null;
};

const send = (res, statusCode, headers, body) => {
  res.writeHead(statusCode, headers);
  res.end(body);
};

const readJsonBody = async (req, limitBytes = 1024 * 100) => {
  return await new Promise((resolve, reject) => {
    let size = 0;
    let chunks = [];
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > limitBytes) {
        reject(new Error("Payload too large"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => {
      try {
        const raw = Buffer.concat(chunks).toString("utf8");
        resolve(raw ? JSON.parse(raw) : {});
      } catch (e) {
        reject(e);
      }
    });
    req.on("error", reject);
  });
};

const httpsJson = async (urlString, { method = "GET", headers = {}, body = null } = {}) => {
  const u = new URL(urlString);
  return await new Promise((resolve, reject) => {
    const req = https.request(
      {
        protocol: u.protocol,
        hostname: u.hostname,
        port: u.port || 443,
        path: u.pathname + u.search,
        method,
        headers,
      },
      (res) => {
        let data = "";
        res.setEncoding("utf8");
        res.on("data", (chunk) => {
          data += chunk;
        });
        res.on("end", () => {
          let json = null;
          try {
            json = data ? JSON.parse(data) : null;
          } catch (_) {
            json = null;
          }
          resolve({ status: res.statusCode || 0, headers: res.headers, text: data, json });
        });
      }
    );
    req.on("error", reject);
    if (body) req.write(body);
    req.end();
  });
};

const extractErrorText = (value) => {
  const seen = new Set();
  const walk = (v) => {
    if (!v || typeof v !== "object") return "";
    if (seen.has(v)) return "";
    seen.add(v);
    if (Array.isArray(v)) {
      for (const item of v) {
        if (typeof item === "string" && item.trim()) return item.trim();
        const got = walk(item);
        if (got) return got;
      }
      return "";
    }
    const direct =
      (typeof v.message === "string" && v.message.trim()) ||
      (typeof v.error === "string" && v.error.trim()) ||
      (typeof v.detail === "string" && v.detail.trim()) ||
      (typeof v.details === "string" && v.details.trim());
    if (direct) return direct;
    for (const k of Object.keys(v)) {
      const item = v[k];
      if (typeof item === "string" && item.trim()) return item.trim();
      const got = walk(item);
      if (got) return got;
    }
    return "";
  };
  if (typeof value === "string") return value.trim();
  return walk(value);
};

const extractFirstUrl = (value) => {
  const seen = new Set();
  const walk = (v) => {
    if (!v || typeof v !== "object") return "";
    if (seen.has(v)) return "";
    seen.add(v);
    if (Array.isArray(v)) {
      for (const item of v) {
        if (typeof item === "string" && /^https?:\/\//i.test(item)) return item;
        const got = walk(item);
        if (got) return got;
      }
      return "";
    }
    for (const k of Object.keys(v)) {
      const item = v[k];
      if (typeof item === "string" && /^https?:\/\//i.test(item)) return item;
      const got = walk(item);
      if (got) return got;
    }
    return "";
  };
  if (typeof value === "string" && /^https?:\/\//i.test(value)) return value;
  return walk(value);
};

const serveFile = async (res, filePath) => {
  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || "application/octet-stream";
  const cacheControl =
    ext === ".html" || ext === ".js" || ext === ".css"
      ? "no-store"
      : "public, max-age=86400";

  const headers = {
    "Content-Type": contentType,
    "Cache-Control": cacheControl
  };

  if (ext === ".html") {
    let html = "";
    try {
      html = await fsp.readFile(filePath, "utf8");
    } catch {
      send(res, 404, { "Content-Type": "text/plain; charset=utf-8" }, "Not Found");
      return;
    }
    const cfg = await getThemeConfigCached();
    const cssVars = buildThemeCssVars(cfg);
    html = injectThemeIntoHtml(html, cssVars);
    const storeConfig = await getStoreConfigCached();
    const supportedLinks = buildSupportedCheatsFooterLinks(storeConfig);
    html = injectSupportedCheatsFooter(html, supportedLinks);
    html = injectSupabaseBrowserClient(html);
    html = injectCleanUrlsIntoHtml(html);
    html = injectSupabaseSessionFromUrlIntoHtml(html);
    html = injectAuthUiFromLocalStorageIntoHtml(html);
    html = injectStaticModuleCacheBusting(html);
    res.writeHead(200, headers);
    res.end(html);
    return;
  }

  res.writeHead(200, headers);
  fs.createReadStream(filePath).pipe(res);
};

const getSupabaseAdmin = () => {
  const url = String(process.env.SUPABASE_URL || "").trim();
  const serviceKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  if (!url || !serviceKey) return null;
  return { url: url.replace(/\/+$/, ""), serviceKey };
};

const supabaseRest = async (sb, method, restPath, { query = "", headers = {}, body = null } = {}) => {
  const u = sb.url + "/rest/v1/" + String(restPath || "").replace(/^\/+/, "");
  const url = query ? u + "?" + String(query || "") : u;
  return await httpsJson(url, {
    method,
    headers: {
      apikey: sb.serviceKey,
      Authorization: `Bearer ${sb.serviceKey}`,
      ...headers,
    },
    body,
  });
};

const getAdminEmail = () => String(process.env.ADMIN_EMAIL || "surgeworldorder@protonmail.com").trim().toLowerCase();

const supabaseAuthAdmin = async (sb, method, authPath, { query = "", headers = {}, body = null } = {}) => {
  const u = sb.url + "/auth/v1/" + String(authPath || "").replace(/^\/+/, "");
  const url = query ? u + "?" + String(query || "") : u;
  return await httpsJson(url, {
    method,
    headers: {
      apikey: sb.serviceKey,
      Authorization: `Bearer ${sb.serviceKey}`,
      "Content-Type": "application/json",
      ...headers,
    },
    body,
  });
};

const findAuthUserByEmail = async (sb, email) => {
  const target = String(email || "").trim().toLowerCase();
  if (!target) return null;

  const filter = target.length >= 3 ? target : "";
  for (let page = 1; page <= 20; page += 1) {
    const q = `page=${page}&per_page=200` + (filter ? `&filter=${encodeURIComponent(filter)}` : "");
    const res = await supabaseAuthAdmin(sb, "GET", "admin/users", { query: q });
    const users = Array.isArray(res?.json?.users) ? res.json.users : [];
    const match = users.find((u) => String(u?.email || "").trim().toLowerCase() === target) || null;
    if (match) return match;
    if (!users.length) return null;
  }
  return null;
};

const handleTeamMe = async (req, res) => {
  const origin = String(req.headers.origin || "").trim();
  const host = String(req.headers.host || "").trim();
  const expectedHttp = host ? `http://${host}` : "";
  const expectedHttps = host ? `https://${host}` : "";
  const allowOrigin = origin && (origin === expectedHttp || origin === expectedHttps) ? origin : "";

  const sb = getSupabaseAdmin();
  if (!sb) {
    send(
      res,
      500,
      {
        "Content-Type": "application/json; charset=utf-8",
        ...(allowOrigin ? { "Access-Control-Allow-Origin": allowOrigin, Vary: "Origin" } : {}),
      },
      JSON.stringify({ ok: false, error: "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY" })
    );
    return;
  }

  const authHeader = String(req.headers.authorization || "").trim();
  const jwt = authHeader.toLowerCase().startsWith("bearer ") ? authHeader.slice(7).trim() : "";
  const userRes = await supabaseGetUserFromJwt(sb, jwt);
  if (!userRes.ok) {
    send(
      res,
      401,
      {
        "Content-Type": "application/json; charset=utf-8",
        ...(allowOrigin ? { "Access-Control-Allow-Origin": allowOrigin, Vary: "Origin" } : {}),
      },
      JSON.stringify({ ok: false, error: "Sign in required" })
    );
    return;
  }

  const email = String(userRes.user?.email || "").trim().toLowerCase();
  const isSuperAdmin = email && email === getAdminEmail();
  const userId = String(userRes.user?.id || "").trim();

  let member = null;
  if (userId) {
    const tm = await supabaseRest(sb, "GET", "team_members", {
      query: "select=user_id,email,is_admin,permissions&user_id=eq." + encodeURIComponent(userId) + "&limit=1",
      headers: { Accept: "application/json" },
    });
    if (tm.status >= 200 && tm.status < 300 && Array.isArray(tm.json) && tm.json[0]) member = tm.json[0];
  }

  const isAdmin = Boolean(isSuperAdmin || member?.is_admin);
  const permissions = member && member.permissions && typeof member.permissions === "object" ? member.permissions : {};

  send(
    res,
    200,
    {
      "Content-Type": "application/json; charset=utf-8",
      ...(allowOrigin ? { "Access-Control-Allow-Origin": allowOrigin, Vary: "Origin" } : {}),
    },
    JSON.stringify({ ok: true, isSuperAdmin, isAdmin, permissions })
  );
};

const handleTeamSet = async (req, res) => {
  const origin = String(req.headers.origin || "").trim();
  const host = String(req.headers.host || "").trim();
  const expectedHttp = host ? `http://${host}` : "";
  const expectedHttps = host ? `https://${host}` : "";
  const allowOrigin = origin && (origin === expectedHttp || origin === expectedHttps) ? origin : "";

  const sb = getSupabaseAdmin();
  if (!sb) {
    send(
      res,
      500,
      {
        "Content-Type": "application/json; charset=utf-8",
        ...(allowOrigin ? { "Access-Control-Allow-Origin": allowOrigin, Vary: "Origin" } : {}),
      },
      JSON.stringify({ ok: false, error: "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY" })
    );
    return;
  }

  const authHeader = String(req.headers.authorization || "").trim();
  const jwt = authHeader.toLowerCase().startsWith("bearer ") ? authHeader.slice(7).trim() : "";
  const callerRes = await supabaseGetUserFromJwt(sb, jwt);
  if (!callerRes.ok) {
    send(
      res,
      401,
      {
        "Content-Type": "application/json; charset=utf-8",
        ...(allowOrigin ? { "Access-Control-Allow-Origin": allowOrigin, Vary: "Origin" } : {}),
      },
      JSON.stringify({ ok: false, error: "Sign in required" })
    );
    return;
  }

  const callerEmail = String(callerRes.user?.email || "").trim().toLowerCase();
  if (!callerEmail || callerEmail !== getAdminEmail()) {
    send(
      res,
      403,
      {
        "Content-Type": "application/json; charset=utf-8",
        ...(allowOrigin ? { "Access-Control-Allow-Origin": allowOrigin, Vary: "Origin" } : {}),
      },
      JSON.stringify({ ok: false, error: "Forbidden" })
    );
    return;
  }

  let payload = null;
  try {
    payload = await readJsonBody(req);
  } catch (_) {
    send(
      res,
      400,
      {
        "Content-Type": "application/json; charset=utf-8",
        ...(allowOrigin ? { "Access-Control-Allow-Origin": allowOrigin, Vary: "Origin" } : {}),
      },
      JSON.stringify({ ok: false, error: "Invalid JSON body" })
    );
    return;
  }

  const targetEmail = String(payload?.email || "").trim().toLowerCase();
  if (!targetEmail) {
    send(
      res,
      400,
      {
        "Content-Type": "application/json; charset=utf-8",
        ...(allowOrigin ? { "Access-Control-Allow-Origin": allowOrigin, Vary: "Origin" } : {}),
      },
      JSON.stringify({ ok: false, error: "Missing email" })
    );
    return;
  }

  const permissions = payload?.permissions && typeof payload.permissions === "object" ? payload.permissions : {};
  const normalizedPerms = {
    overview_access: Boolean(permissions.overview_access),
    forums_manage: Boolean(permissions.forums_manage),
    products_manage: Boolean(permissions.products_manage),
    status_manage: Boolean(permissions.status_manage),
    checkout_manage: Boolean(permissions.checkout_manage),
    guides_manage: Boolean(permissions.guides_manage),
    customer_manual: Boolean(permissions.customer_manual),
  };

  const targetUser = await findAuthUserByEmail(sb, targetEmail);
  if (!targetUser) {
    send(
      res,
      404,
      {
        "Content-Type": "application/json; charset=utf-8",
        ...(allowOrigin ? { "Access-Control-Allow-Origin": allowOrigin, Vary: "Origin" } : {}),
      },
      JSON.stringify({ ok: false, error: "User not found" })
    );
    return;
  }

  const userId = String(targetUser?.id || "").trim();
  if (!userId) {
    send(
      res,
      502,
      {
        "Content-Type": "application/json; charset=utf-8",
        ...(allowOrigin ? { "Access-Control-Allow-Origin": allowOrigin, Vary: "Origin" } : {}),
      },
      JSON.stringify({ ok: false, error: "Invalid user id" })
    );
    return;
  }

  const upsert = await supabaseRest(sb, "POST", "team_members", {
    headers: { "Content-Type": "application/json", Prefer: "resolution=merge-duplicates,return=representation" },
    body: JSON.stringify({ user_id: userId, email: targetEmail, is_admin: true, permissions: normalizedPerms }),
  });

  if (upsert.status < 200 || upsert.status >= 300) {
    send(
      res,
      502,
      {
        "Content-Type": "application/json; charset=utf-8",
        ...(allowOrigin ? { "Access-Control-Allow-Origin": allowOrigin, Vary: "Origin" } : {}),
      },
      JSON.stringify({ ok: false, error: "Failed to save team member", body: upsert.json || upsert.text })
    );
    return;
  }

  await supabaseAuthAdmin(sb, "PUT", "admin/users/" + encodeURIComponent(userId), {
    body: JSON.stringify({
      app_metadata: {
        ...(targetUser?.app_metadata && typeof targetUser.app_metadata === "object" ? targetUser.app_metadata : {}),
        role: "admin",
      },
      user_metadata: {
        ...(targetUser?.user_metadata && typeof targetUser.user_metadata === "object" ? targetUser.user_metadata : {}),
        role: "admin",
      },
    }),
  }).catch(() => null);

  await supabaseRest(sb, "PATCH", "profiles", {
    query: "id=eq." + encodeURIComponent(userId),
    headers: { "Content-Type": "application/json", Prefer: "return=minimal" },
    body: JSON.stringify({ role: "Admin" }),
  }).catch(() => null);

  send(
    res,
    200,
    {
      "Content-Type": "application/json; charset=utf-8",
      ...(allowOrigin ? { "Access-Control-Allow-Origin": allowOrigin, Vary: "Origin" } : {}),
    },
    JSON.stringify({ ok: true, user: { id: userId, email: targetEmail }, permissions: normalizedPerms })
  );
};

const handleTeamList = async (req, res) => {
  const origin = String(req.headers.origin || "").trim();
  const host = String(req.headers.host || "").trim();
  const expectedHttp = host ? `http://${host}` : "";
  const expectedHttps = host ? `https://${host}` : "";
  const allowOrigin = origin && (origin === expectedHttp || origin === expectedHttps) ? origin : "";

  const sb = getSupabaseAdmin();
  if (!sb) {
    send(
      res,
      500,
      {
        "Content-Type": "application/json; charset=utf-8",
        ...(allowOrigin ? { "Access-Control-Allow-Origin": allowOrigin, Vary: "Origin" } : {}),
      },
      JSON.stringify({ ok: false, error: "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY" })
    );
    return;
  }

  const authHeader = String(req.headers.authorization || "").trim();
  const jwt = authHeader.toLowerCase().startsWith("bearer ") ? authHeader.slice(7).trim() : "";
  const callerRes = await supabaseGetUserFromJwt(sb, jwt);
  if (!callerRes.ok) {
    send(
      res,
      401,
      {
        "Content-Type": "application/json; charset=utf-8",
        ...(allowOrigin ? { "Access-Control-Allow-Origin": allowOrigin, Vary: "Origin" } : {}),
      },
      JSON.stringify({ ok: false, error: "Sign in required" })
    );
    return;
  }

  const callerEmail = String(callerRes.user?.email || "").trim().toLowerCase();
  if (!callerEmail || callerEmail !== getAdminEmail()) {
    send(
      res,
      403,
      {
        "Content-Type": "application/json; charset=utf-8",
        ...(allowOrigin ? { "Access-Control-Allow-Origin": allowOrigin, Vary: "Origin" } : {}),
      },
      JSON.stringify({ ok: false, error: "Forbidden" })
    );
    return;
  }

  const tm = await supabaseRest(sb, "GET", "team_members", {
    query: "select=user_id,email,is_admin,permissions,created_at,updated_at&is_admin=eq.true&order=updated_at.desc.nullslast&limit=200",
    headers: { Accept: "application/json" },
  });

  if (tm.status < 200 || tm.status >= 300) {
    send(
      res,
      502,
      {
        "Content-Type": "application/json; charset=utf-8",
        ...(allowOrigin ? { "Access-Control-Allow-Origin": allowOrigin, Vary: "Origin" } : {}),
      },
      JSON.stringify({ ok: false, error: "Failed to load team members", body: tm.json || tm.text })
    );
    return;
  }

  send(
    res,
    200,
    {
      "Content-Type": "application/json; charset=utf-8",
      ...(allowOrigin ? { "Access-Control-Allow-Origin": allowOrigin, Vary: "Origin" } : {}),
    },
    JSON.stringify({ ok: true, members: Array.isArray(tm.json) ? tm.json : [] })
  );
};

const handleTeamRemove = async (req, res) => {
  const origin = String(req.headers.origin || "").trim();
  const host = String(req.headers.host || "").trim();
  const expectedHttp = host ? `http://${host}` : "";
  const expectedHttps = host ? `https://${host}` : "";
  const allowOrigin = origin && (origin === expectedHttp || origin === expectedHttps) ? origin : "";

  const sb = getSupabaseAdmin();
  if (!sb) {
    send(
      res,
      500,
      {
        "Content-Type": "application/json; charset=utf-8",
        ...(allowOrigin ? { "Access-Control-Allow-Origin": allowOrigin, Vary: "Origin" } : {}),
      },
      JSON.stringify({ ok: false, error: "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY" })
    );
    return;
  }

  const authHeader = String(req.headers.authorization || "").trim();
  const jwt = authHeader.toLowerCase().startsWith("bearer ") ? authHeader.slice(7).trim() : "";
  const callerRes = await supabaseGetUserFromJwt(sb, jwt);
  if (!callerRes.ok) {
    send(
      res,
      401,
      {
        "Content-Type": "application/json; charset=utf-8",
        ...(allowOrigin ? { "Access-Control-Allow-Origin": allowOrigin, Vary: "Origin" } : {}),
      },
      JSON.stringify({ ok: false, error: "Sign in required" })
    );
    return;
  }

  const callerEmail = String(callerRes.user?.email || "").trim().toLowerCase();
  if (!callerEmail || callerEmail !== getAdminEmail()) {
    send(
      res,
      403,
      {
        "Content-Type": "application/json; charset=utf-8",
        ...(allowOrigin ? { "Access-Control-Allow-Origin": allowOrigin, Vary: "Origin" } : {}),
      },
      JSON.stringify({ ok: false, error: "Forbidden" })
    );
    return;
  }

  let payload = null;
  try {
    payload = await readJsonBody(req);
  } catch (_) {
    send(
      res,
      400,
      {
        "Content-Type": "application/json; charset=utf-8",
        ...(allowOrigin ? { "Access-Control-Allow-Origin": allowOrigin, Vary: "Origin" } : {}),
      },
      JSON.stringify({ ok: false, error: "Invalid JSON body" })
    );
    return;
  }

  const targetEmail = String(payload?.email || "").trim().toLowerCase();
  if (!targetEmail) {
    send(
      res,
      400,
      {
        "Content-Type": "application/json; charset=utf-8",
        ...(allowOrigin ? { "Access-Control-Allow-Origin": allowOrigin, Vary: "Origin" } : {}),
      },
      JSON.stringify({ ok: false, error: "Missing email" })
    );
    return;
  }

  if (targetEmail === getAdminEmail()) {
    send(
      res,
      400,
      {
        "Content-Type": "application/json; charset=utf-8",
        ...(allowOrigin ? { "Access-Control-Allow-Origin": allowOrigin, Vary: "Origin" } : {}),
      },
      JSON.stringify({ ok: false, error: "Cannot remove super admin" })
    );
    return;
  }

  const targetUser = await findAuthUserByEmail(sb, targetEmail);
  const userId = String(targetUser?.id || "").trim();

  if (userId) {
    await supabaseRest(sb, "DELETE", "team_members", {
      query: "user_id=eq." + encodeURIComponent(userId),
      headers: { Prefer: "return=minimal" },
    }).catch(() => null);
  } else {
    await supabaseRest(sb, "DELETE", "team_members", {
      query: "email=eq." + encodeURIComponent(targetEmail),
      headers: { Prefer: "return=minimal" },
    }).catch(() => null);
  }

  if (userId) {
    await supabaseAuthAdmin(sb, "PUT", "admin/users/" + encodeURIComponent(userId), {
      body: JSON.stringify({
        app_metadata: {
          ...(targetUser?.app_metadata && typeof targetUser.app_metadata === "object" ? targetUser.app_metadata : {}),
          role: "user",
        },
        user_metadata: {
          ...(targetUser?.user_metadata && typeof targetUser.user_metadata === "object" ? targetUser.user_metadata : {}),
          role: "user",
        },
      }),
    }).catch(() => null);

    await supabaseRest(sb, "PATCH", "profiles", {
      query: "id=eq." + encodeURIComponent(userId),
      headers: { "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify({ role: "User" }),
    }).catch(() => null);
  }

  send(
    res,
    200,
    {
      "Content-Type": "application/json; charset=utf-8",
      ...(allowOrigin ? { "Access-Control-Allow-Origin": allowOrigin, Vary: "Origin" } : {}),
    },
    JSON.stringify({ ok: true })
  );
};

const supabaseGetUserFromJwt = async (sb, jwt) => {
  const token = String(jwt || "").trim();
  if (!token) return { ok: false, status: 401, user: null };
  const res = await httpsJson(sb.url + "/auth/v1/user", {
    method: "GET",
    headers: {
      apikey: sb.serviceKey,
      Authorization: `Bearer ${token}`,
    },
  });
  if (res.status < 200 || res.status >= 300 || !res.json) return { ok: false, status: res.status || 401, user: null };
  return { ok: true, status: 200, user: res.json };
};

const normalizeKeysList = (value) => {
  if (Array.isArray(value)) return value.map((x) => String(x || "").trim()).filter(Boolean);
  const s = String(value || "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  return s
    .split("\n")
    .map((x) => String(x || "").trim())
    .filter(Boolean);
};

const DEFAULT_SUPABASE_URL = "https://tjpxmbfekgnxtyujvyvx.supabase.co";
const DEFAULT_SUPABASE_ANON_KEY = "sb_publishable_MY0T9tn8TU567ZRsnoZHyA_gGqyVs2W";

const getSupabaseRead = () => {
  const url = String(process.env.SUPABASE_URL || DEFAULT_SUPABASE_URL).trim().replace(/\/+$/, "");
  const serviceKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON_KEY).trim();
  if (!url || !serviceKey) return null;
  return { url, serviceKey };
};

const loadStoreConfigFromSupabase = async (sb) => {
  const storeRes = await supabaseRest(sb, "GET", "site_kv", {
    query: "select=value&key=eq.store_config&limit=1",
    headers: { Accept: "application/json" },
  });
  const storeRow = Array.isArray(storeRes.json) ? storeRes.json[0] : null;
  const storeConfig = storeRow && storeRow.value && typeof storeRow.value === "object" ? storeRow.value : null;
  return storeConfig || null;
};

let themeConfigCache = null;
let themeConfigCacheAt = 0;
const THEME_CACHE_TTL_MS = 15_000;

let storeConfigCache = null;
let storeConfigCacheAt = 0;
const STORE_CACHE_TTL_MS = 15_000;

const loadThemeConfigFromSupabase = async (sb) => {
  const res = await supabaseRest(sb, "GET", "site_kv", {
    query: "select=value&key=eq.theme_config&limit=1",
    headers: { Accept: "application/json" },
  });
  const row = Array.isArray(res.json) ? res.json[0] : null;
  const cfg = row && row.value && typeof row.value === "object" ? row.value : null;
  return cfg || null;
};

const normalizeHex = (value) => {
  const s = String(value || "").trim();
  if (!/^#[0-9a-fA-F]{6}$/.test(s)) return "";
  return s.toLowerCase();
};

const hexToRgbTriplet = (hex) => {
  const h = normalizeHex(hex);
  if (!h) return "";
  const r = Number.parseInt(h.slice(1, 3), 16);
  const g = Number.parseInt(h.slice(3, 5), 16);
  const b = Number.parseInt(h.slice(5, 7), 16);
  return `${r}, ${g}, ${b}`;
};

const buildThemeCssVars = (cfg) => {
  const primaryHex = normalizeHex(cfg?.primaryHex) || "";
  const secondaryHex = normalizeHex(cfg?.secondaryHex) || "";
  const accentHex = normalizeHex(cfg?.accentHex) || primaryHex || "";
  if (!primaryHex || !secondaryHex) return "";
  const primaryRgb = hexToRgbTriplet(primaryHex);
  const secondaryRgb = hexToRgbTriplet(secondaryHex);
  if (!primaryRgb || !secondaryRgb) return "";
  const gradient = `linear-gradient(60deg, ${secondaryHex}, ${primaryHex})`;
  return (
    ":root{" +
    `--theme-brand_primary:${primaryRgb} !important;` +
    `--theme-brand_secondary:${secondaryRgb} !important;` +
    (accentHex ? `--theme-brand_accent_hex:${accentHex} !important;` : "") +
    `--theme-brand_gradient:${gradient} !important;` +
    `--theme-brand_gradient_webkit:${gradient} !important;` +
    "}"
  );
};

const injectThemeIntoHtml = (html, cssVars) => {
  if (!cssVars) return html;
  const styleTag = `<style id="kylo-theme-vars">${cssVars}</style>`;
  if (html.includes('id="kylo-theme-vars"')) {
    return html.replace(/<style id="kylo-theme-vars">[\s\S]*?<\/style>/i, styleTag);
  }
  const m = html.match(/<head[^>]*>/i);
  if (!m) return html;
  const i = html.indexOf(m[0]) + m[0].length;
  return html.slice(0, i) + styleTag + html.slice(i);
};

const getThemeConfigCached = async () => {
  const sb = getSupabaseRead();
  if (!sb) return null;
  const now = Date.now();
  if (themeConfigCache && now - themeConfigCacheAt < THEME_CACHE_TTL_MS) return themeConfigCache;
  const cfg = await loadThemeConfigFromSupabase(sb).catch(() => null);
  themeConfigCache = cfg;
  themeConfigCacheAt = now;
  return cfg;
};

const getStoreConfigCached = async () => {
  const sb = getSupabaseRead();
  if (!sb) return null;
  const now = Date.now();
  if (storeConfigCache && now - storeConfigCacheAt < STORE_CACHE_TTL_MS) return storeConfigCache;
  const cfg = await loadStoreConfigFromSupabase(sb).catch(() => null);
  storeConfigCache = cfg;
  storeConfigCacheAt = now;
  return cfg;
};

const escapeHtml = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const buildSupportedCheatsFooterLinks = (storeConfig) => {
  const cfg = storeConfig && typeof storeConfig === "object" ? storeConfig : null;
  const products = cfg && Array.isArray(cfg.products) ? cfg.products : [];
  const items = products
    .map((p) => ({
      slug: String(p?.slug || "").trim(),
      name: String(p?.name || p?.slug || "").trim(),
    }))
    .filter((p) => p.slug && p.name)
    .slice(0, 8);

  if (!items.length) return "";
  const left = items.slice(0, 4);
  const right = items.slice(4, 8);
  const li = (p) => `<li><a href="/product?=${encodeURIComponent(p.slug)}">${escapeHtml(p.name)}</a></li>`;
  const leftHtml = `<ul class="cFooterLinks_list">${left.map(li).join("")}</ul>`;
  const rightHtml = `<ul class="cFooterLinks_list">${right.map(li).join("")}</ul>`;
  return `<div class="cFooterLinks">${leftHtml}${rightHtml}</div>`;
};

const injectSupportedCheatsFooter = (html, linksHtml) => {
  if (!linksHtml) return html;
  const re = /(<h2[^>]*class=["']cFooterLinks_title["'][^>]*>\s*Supported Cheats\s*<\/h2>\s*)<div[^>]*class=["']cFooterLinks["'][^>]*>[\s\S]*?<\/div>/gi;
  if (!re.test(html)) return html;
  return html.replace(re, (_m, h2) => `${h2}${linksHtml}`);
};

const injectCleanUrlsIntoHtml = (html) => {
  const script = `<script id="kylo-clean-urls">(function(){function isSkippableHref(h){if(!h)return true;var s=String(h).trim();if(!s)return true;if(s[0]==="#")return true;var l=s.toLowerCase();return l.startsWith("mailto:")||l.startsWith("tel:")||l.startsWith("javascript:")||l.startsWith("data:")||l.startsWith("blob:")||l.startsWith("http://")||l.startsWith("https://");}function toClean(u){try{var url=new URL(u,window.location.href);if(url.origin!==window.location.origin)return null;var p=url.pathname||"/";if(/\\/index\\.html$/i.test(p))p=p.replace(/\\/index\\.html$/i,"/");else p=p.replace(/\\.html$/i,"");url.pathname=p;return url.pathname+url.search+url.hash;}catch(_){return null;}}function rewriteAll(){var links=document.querySelectorAll("a[href]");for(var i=0;i<links.length;i++){var a=links[i];var h=a.getAttribute("href");if(isSkippableHref(h))continue;var cleaned=toClean(h);if(cleaned&&cleaned!==h)a.setAttribute("href",cleaned);} }document.addEventListener("click",function(e){var t=e.target;var a=t&&t.closest?t.closest("a[href]"):null;if(!a)return;var h=a.getAttribute("href");if(isSkippableHref(h))return;var cleaned=toClean(h);if(!cleaned||cleaned===h)return;a.setAttribute("href",cleaned);});if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",rewriteAll);else rewriteAll();})();</script>`;
  if (html.includes('id="kylo-clean-urls"')) {
    return html.replace(/<script id="kylo-clean-urls">[\s\S]*?<\/script>/i, script);
  }
  if (/<\/body>/i.test(html)) return html.replace(/<\/body>/i, script + "</body>");
  return html;
};

const injectSupabaseBrowserClient = (html) => {
  const marker = 'id="kylo-supabase-browser-client"';
  const scriptTag =
    '<script id="kylo-supabase-browser-client" src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js"></script>';
  if (html.includes(marker)) return html;
  const supabaseAuthScriptRegex = /<script[^>]+src=(["'])supabase-auth\.js(?:\?[^"']*)?\1[^>]*><\/script>/i;
  if (supabaseAuthScriptRegex.test(html)) {
    return html.replace(supabaseAuthScriptRegex, `${scriptTag}$&`);
  }
  if (/<\/head>/i.test(html)) return html.replace(/<\/head>/i, scriptTag + "</head>");
  return html;
};

const injectSupabaseSessionFromUrlIntoHtml = (html) => {
  const script = `<script id="kylo-supabase-session-from-url">(function(){function hasAuthInUrl(){try{var u=new URL(window.location.href);var h=u.hash&&u.hash[0]==="#"?u.hash.slice(1):u.hash;var hp=new URLSearchParams(h||"");if(hp.get("access_token")||hp.get("refresh_token")||hp.get("token")||hp.get("type"))return true;if(u.searchParams.get("code")||u.searchParams.get("token")||u.searchParams.get("type"))return true;return false;}catch(_){return false;}}function getSupabase(){return window.kyloSupabase||((window.__supabaseAuth&&window.__supabaseAuth.supabase)?window.__supabaseAuth.supabase:null)||null;}function cleanUrl(){try{var u=new URL(window.location.href);u.hash="";u.searchParams.delete("code");u.searchParams.delete("token");u.searchParams.delete("type");window.history.replaceState({},document.title,u.pathname+(u.search?u.search:""));}catch(_){}}function run(sb){try{if(!sb||!sb.auth)return;var u=new URL(window.location.href);var code=u.searchParams.get("code")||"";var auth=sb.auth;var p=null;if(typeof auth.getSessionFromUrl==="function"){p=auth.getSessionFromUrl({storeSession:true});}else if(code&&typeof auth.exchangeCodeForSession==="function"){p=auth.exchangeCodeForSession(code);}if(!p)return;Promise.resolve(p).then(function(){cleanUrl();}).catch(function(){cleanUrl();});}catch(_){}}if(!hasAuthInUrl())return;var tries=0;var max=120;var tick=function(){var sb=getSupabase();if(sb){run(sb);return;}tries++;if(tries<max)setTimeout(tick,50);};tick();})();</script>`;
  if (html.includes('id="kylo-supabase-session-from-url"')) {
    return html.replace(/<script id="kylo-supabase-session-from-url">[\s\S]*?<\/script>/i, script);
  }
  if (/<\/body>/i.test(html)) return html.replace(/<\/body>/i, script + "</body>");
  return html;
};

const injectAuthUiFromLocalStorageIntoHtml = (html) => {
  const script = `<script id="kylo-auth-ui-from-storage">(function(){function getRef(){try{var u=String(window.kyloSupabaseUrl||"").trim();var m=u.match(/https:\\/\\/([a-z0-9]+)\\.supabase\\.co/i);return m?m[1]:"";}catch(_){return "";}}function readSession(){try{var ref=getRef();var key=ref?("sb-"+ref+"-auth-token"):"";var raw=key?localStorage.getItem(key):"";if(!raw){for(var i=0;i<localStorage.length;i++){var k=localStorage.key(i)||"";if(/^sb-[a-z0-9]+-auth-token$/i.test(k)){raw=localStorage.getItem(k)||\"\";if(raw)break;}}}if(!raw)return null;var data=JSON.parse(raw);var session=(data&&typeof data==='object'&&(data.currentSession||data.session))? (data.currentSession||data.session) : data;var user=(session&&session.user)?session.user:(data&&data.user?data.user:null);if(!user)return null;return {user:user,session:session};}catch(_){return null;}}function ensureStyles(){try{if(document.getElementById('kyloAuthUiStyles'))return;var s=document.createElement('style');s.id='kyloAuthUiStyles';s.textContent='#elUserSignIn .supabaseUserAvatar{width:2.65em;height:2.65em;border-radius:50%;object-fit:cover;margin-right:.8em;vertical-align:middle;display:inline-block}#elUserSignIn .supabaseUserLabel{vertical-align:middle;font-size:1.1em;font-weight:600;line-height:1}';document.head.appendChild(s);}catch(_){}}function applySignedIn(user){try{window.currentUser=user||null;ensureStyles();var desktop=document.getElementById('elUserSignIn');var mobile=document.getElementById('elSigninButton_mobile');var signUpDesktop=document.getElementById('elRegisterButton');var signUpMobile=document.getElementById('elRegisterButton_mobile');var label=(user&&user.user_metadata&&user.user_metadata.full_name)|| (user&&user.email?String(user.email).split('@')[0]:'') || 'Account';var avatar=(user&&user.user_metadata&&(user.user_metadata.avatar_url||user.user_metadata.picture||user.user_metadata.picture_url||user.user_metadata.avatar||user.user_metadata.photo_url))||'';if(desktop){desktop.replaceChildren();if(avatar){var img=document.createElement('img');img.src=avatar;img.alt=label;img.className='supabaseUserAvatar';img.referrerPolicy='no-referrer';desktop.appendChild(img);}var sp=document.createElement('span');sp.className='supabaseUserLabel';sp.textContent=label;desktop.appendChild(sp);desktop.appendChild(document.createTextNode(' '));var caret=document.createElement('i');caret.className='fa fa-caret-down';desktop.appendChild(caret);}if(mobile) mobile.textContent=label;if(signUpDesktop) signUpDesktop.style.display='none';if(signUpMobile) signUpMobile.style.display='none';}catch(_){}}function apply(){var got=readSession();if(got&&got.user){applySignedIn(got.user);}}if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',apply);else apply();window.addEventListener('storage',function(e){try{var k=String(e&&e.key||'');if(k&&/sb-[a-z0-9]+-auth-token/i.test(k))apply();}catch(_){}});})();</script>`;
  if (html.includes('id="kylo-auth-ui-from-storage"')) {
    return html.replace(/<script id="kylo-auth-ui-from-storage">[\s\S]*?<\/script>/i, script);
  }
  if (/<\/body>/i.test(html)) return html.replace(/<\/body>/i, script + "</body>");
  return html;
};

const injectStaticModuleCacheBusting = (html) => {
  let next = html;
  next = next.replace(
    /src=(["'])supabase-auth\.js(?:\?[^"']*)?\1/gi,
    (_m, quote) => `src=${quote}supabase-auth.js?v=${STATIC_BUST_VERSION}${quote}`
  );
  next = next.replace(
    /src=(["'])purchases-client\.js(?:\?[^"']*)?\1/gi,
    (_m, quote) => `src=${quote}purchases-client.js?v=${STATIC_BUST_VERSION}${quote}`
  );
  next = next.replace(
    /src=(["'])reviews-client\.js(?:\?[^"']*)?\1/gi,
    (_m, quote) => `src=${quote}reviews-client.js?v=${STATIC_BUST_VERSION}${quote}`
  );
  next = next.replace(
    /src=(["'])mobile-drawer\.js(?:\?[^"']*)?\1/gi,
    (_m, quote) => `src=${quote}mobile-drawer.js?v=${STATIC_BUST_VERSION}${quote}`
  );
  return next;
};

const DEFAULT_NOTIFICATIONS_CONFIG = {
  enabled: false,
  webhookUrl: "",
  showLogged: true,
  showProductPrice: true,
  showLicense: true,
  showStockLeft: true,
};

const normalizeNotificationsConfig = (input) => {
  const cfg = input && typeof input === "object" ? input : {};
  const enabled = Boolean(cfg.enabled);
  const webhookUrl = typeof cfg.webhookUrl === "string" ? cfg.webhookUrl.trim() : "";
  const showLogged = cfg.showLogged === undefined ? true : Boolean(cfg.showLogged);
  const showProductPrice = cfg.showProductPrice === undefined ? true : Boolean(cfg.showProductPrice);
  const showLicense = cfg.showLicense === undefined ? true : Boolean(cfg.showLicense);
  const showStockLeft = cfg.showStockLeft === undefined ? true : Boolean(cfg.showStockLeft);
  return { enabled, webhookUrl, showLogged, showProductPrice, showLicense, showStockLeft };
};

let notificationsConfigCache = null;
let notificationsConfigCacheAt = 0;
const NOTIFICATIONS_CACHE_TTL_MS = 15_000;

const loadNotificationsConfigFromSupabase = async (sb) => {
  const res = await supabaseRest(sb, "GET", "site_kv", {
    query: "select=value&key=eq.notifications_config&limit=1",
    headers: { Accept: "application/json" },
  });
  const row = Array.isArray(res.json) ? res.json[0] : null;
  const cfg = row && row.value && typeof row.value === "object" ? row.value : null;
  return normalizeNotificationsConfig(cfg || DEFAULT_NOTIFICATIONS_CONFIG);
};

const getNotificationsConfigCached = async () => {
  const sb = getSupabaseRead();
  if (!sb) return DEFAULT_NOTIFICATIONS_CONFIG;
  const now = Date.now();
  if (notificationsConfigCache && now - notificationsConfigCacheAt < NOTIFICATIONS_CACHE_TTL_MS) return notificationsConfigCache;
  const cfg = await loadNotificationsConfigFromSupabase(sb).catch(() => DEFAULT_NOTIFICATIONS_CONFIG);
  notificationsConfigCache = cfg;
  notificationsConfigCacheAt = now;
  return cfg;
};

const formatMoney = (amount, currency) => {
  const n = Number.isFinite(amount) ? amount : Number.parseFloat(String(amount || "0"));
  const v = Number.isFinite(n) ? n : 0;
  const c = String(currency || "USD").trim().toUpperCase() || "USD";
  return `${v.toFixed(2)} ${c}`;
};

const truncate = (s, max) => {
  const str = String(s || "");
  const m = Math.max(0, Number(max) || 0);
  if (!m || str.length <= m) return str;
  return str.slice(0, m - 1) + "…";
};

const postDiscordWebhook = async (webhookUrl, payload) => {
  const url = String(webhookUrl || "").trim();
  if (!url) return { ok: false, status: 0, error: "Missing webhookUrl" };
  if (!/^https:\/\//i.test(url)) return { ok: false, status: 0, error: "Webhook URL must be https://" };
  const res = await httpsJson(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
  const ok = res.status >= 200 && res.status < 300;
  return { ok, status: res.status, error: ok ? "" : String(res.text || res.status) };
};

const buildDiscordPurchasePayload = ({ purchase, isLogged, purchaserEmail, allocations, stockLeftMap, config }) => {
  const p = purchase && typeof purchase === "object" ? purchase : {};
  const currency = String(p.currency || "USD").trim().toUpperCase() || "USD";
  const total = Number.isFinite(p.total_price) ? p.total_price : Number.parseFloat(String(p.total_price || "0")) || 0;
  const title = String(p.order_name || "Purchase").trim() || "Purchase";

  const fields = [];
  const cfg = normalizeNotificationsConfig(config);

  if (cfg.showLogged) {
    fields.push({ name: "Is Logged", value: isLogged ? "Yes" : "No", inline: true });
  }
  if (isLogged) {
    const email = String(purchaserEmail || p.purchaser_email || "").trim();
    if (email) fields.push({ name: "User", value: email, inline: true });
  }

  if (cfg.showProductPrice) {
    const items = Array.isArray(p.line_items) ? p.line_items : [];
    const lines = items
      .map((it) => {
        const name = String(it?.title || "Product").trim();
        const variant = String(it?.variant || "").trim();
        const qty = Number.isFinite(it?.quantity) ? Math.max(1, Math.floor(it.quantity)) : 1;
        const cents = Number.isFinite(it?.priceCents) ? it.priceCents : 0;
        const lineTotal = (Math.max(0, cents) * qty) / 100;
        return `${name}${variant ? ` (${variant})` : ""} x${qty} — ${formatMoney(lineTotal, currency)}`;
      })
      .filter(Boolean);
    const value = lines.length ? lines.join("\n") : "—";
    fields.push({ name: "Purchased Product + Price", value: truncate(value, 1024), inline: false });
  }

  if (cfg.showLicense) {
    const list = Array.isArray(allocations) ? allocations : Array.isArray(p.license_keys) ? p.license_keys : [];
    const lines = list
      .map((x) => {
        const key = String(x?.key || "").trim();
        const slug = String(x?.product_slug || x?.productSlug || "").trim();
        const variant = String(x?.variant || "").trim();
        if (!key) return "";
        return `${slug ? slug : "product"}${variant ? ` (${variant})` : ""}: ${key}`;
      })
      .filter(Boolean);
    const shown = lines.slice(0, 12);
    const more = lines.length > shown.length ? `\n… (+${lines.length - shown.length} more)` : "";
    const value = shown.length ? "```" + truncate(shown.join("\n"), 980) + "```" + more : "—";
    fields.push({ name: "Received License", value: truncate(value, 1024), inline: false });
  }

  if (cfg.showStockLeft) {
    const entries = stockLeftMap && typeof stockLeftMap === "object" ? Object.entries(stockLeftMap) : [];
    const lines = entries
      .map(([k, v]) => {
        const parts = String(k).split("|");
        const slug = String(parts[0] || "").trim();
        const variant = String(parts[1] || "").trim();
        const left = Number.isFinite(v) ? v : Number.parseInt(String(v || "0"), 10);
        if (!slug) return "";
        return `${slug}${variant ? ` (${variant})` : ""}: ${Number.isFinite(left) ? left : 0}`;
      })
      .filter(Boolean)
      .slice(0, 12);
    const value = lines.length ? truncate(lines.join("\n"), 1024) : "—";
    fields.push({ name: "Stock Left", value, inline: false });
  }

  const embed = {
    title: `Checkout Completed — ${title}`,
    description: `Total: ${formatMoney(total, currency)}`,
    fields,
    timestamp: new Date().toISOString(),
  };

  return { embeds: [embed] };
};

const computeCartStockShortages = (storeConfig, cartItems) => {
  const cfg = storeConfig && typeof storeConfig === "object" ? storeConfig : null;
  if (!cfg) return [{ product: "", variant: "", reason: "Missing store_config" }];
  cfg.products = Array.isArray(cfg.products) ? cfg.products : [];

  const shortages = [];
  const items = Array.isArray(cartItems) ? cartItems : [];

  for (const it of items) {
    const productSlug = String(it?.productSlug || it?.product_slug || "").trim();
    const productName = String(it?.productName || it?.title || it?.product_name || "").trim();
    const variantId = String(it?.variantId || it?.variant_id || "").trim();
    const variantName = String(it?.variantName || it?.variant || it?.variant_name || "").trim();
    const qty = Number.isFinite(it?.quantity) ? Math.max(1, Math.floor(it.quantity)) : 1;

    const slugKey = productSlug.toLowerCase();
    const nameKey = productName.toLowerCase();

    const product =
      (slugKey ? cfg.products.find((p) => String(p?.slug || "").trim().toLowerCase() === slugKey) : null) ||
      (nameKey ? cfg.products.find((p) => String(p?.name || "").trim().toLowerCase() === nameKey) : null) ||
      null;

    if (!product) {
      shortages.push({ product: productSlug || productName, variant: variantName, reason: "Product not found" });
      continue;
    }

    product.variants = Array.isArray(product.variants) ? product.variants : [];
    const variant =
      (variantId ? product.variants.find((v) => String(v?.variantId || "").trim() === variantId) : null) ||
      (variantName
        ? product.variants.find((v) => String(v?.name || "").trim().toLowerCase() === variantName.toLowerCase())
        : null) ||
      null;

    if (!variant) {
      shortages.push({ product: String(product.slug || product.name || productName || ""), variant: variantName, reason: "Variant not found" });
      continue;
    }

    const available = normalizeKeysList(variant.licenseKeys).length;
    if (available < qty) {
      shortages.push({
        product: String(product.slug || product.name || productName || ""),
        variant: String(variant.name || variantName || ""),
        reason: "Out of stock",
        available,
        requested: qty,
      });
    }
  }

  return shortages;
};

const handleMoneyMotionFulfill = async (req, res) => {
  const origin = String(req.headers.origin || "").trim();
  const host = String(req.headers.host || "").trim();
  const expectedHttp = host ? `http://${host}` : "";
  const expectedHttps = host ? `https://${host}` : "";
  const allowOrigin = origin && (origin === expectedHttp || origin === expectedHttps) ? origin : "";

  const sb = getSupabaseAdmin();
  if (!sb) {
    send(
      res,
      500,
      {
        "Content-Type": "application/json; charset=utf-8",
        ...(allowOrigin ? { "Access-Control-Allow-Origin": allowOrigin, Vary: "Origin" } : {}),
      },
      JSON.stringify({ error: "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY" })
    );
    return;
  }

  let payload = null;
  try {
    payload = await readJsonBody(req);
  } catch (_) {
    send(
      res,
      400,
      {
        "Content-Type": "application/json; charset=utf-8",
        ...(allowOrigin ? { "Access-Control-Allow-Origin": allowOrigin, Vary: "Origin" } : {}),
      },
      JSON.stringify({ error: "Invalid JSON body" })
    );
    return;
  }

  const checkoutSessionId = String(payload?.checkoutSessionId || payload?.checkout_session_id || "").trim();
  if (!checkoutSessionId) {
    send(
      res,
      400,
      {
        "Content-Type": "application/json; charset=utf-8",
        ...(allowOrigin ? { "Access-Control-Allow-Origin": allowOrigin, Vary: "Origin" } : {}),
      },
      JSON.stringify({ error: "Missing checkoutSessionId" })
    );
    return;
  }

  const authHeader = String(req.headers.authorization || "").trim();
  const jwt = authHeader.toLowerCase().startsWith("bearer ") ? authHeader.slice(7).trim() : "";
  const userRes = jwt ? await supabaseGetUserFromJwt(sb, jwt) : { ok: false, user: null };
  const userId = userRes.ok ? String(userRes.user?.id || "").trim() : "";
  const email = userRes.ok ? String(userRes.user?.email || "").trim().toLowerCase() : "";

  const existing = await supabaseRest(sb, "GET", "purchases", {
    query:
      "select=id,user_id,purchaser_email,order_name,financial_status,currency,total_price,created_at,processed_at,line_items,license_keys,raw&provider_checkout_session_id=eq." +
      encodeURIComponent(checkoutSessionId) +
      "&limit=1",
    headers: { Accept: "application/json" },
  });
  if (existing.status >= 200 && existing.status < 300 && Array.isArray(existing.json) && existing.json[0]) {
    const row = existing.json[0];
    const rowUserId = String(row?.user_id || "").trim();
    const rowEmail = String(row?.purchaser_email || "").trim().toLowerCase();
    const providedToken = String(payload?.successToken || payload?.t || payload?.token || "").trim();
    const storedToken =
      row?.raw && typeof row.raw === "object" ? String(row.raw.success_token || row.raw.successToken || "").trim() : "";
    const tokenOk = storedToken && providedToken && storedToken === providedToken;
    const okForUser = (rowUserId && userId && rowUserId === userId) || (rowEmail && email && rowEmail === email);
    const canProceed = userRes.ok ? okForUser || (tokenOk && !rowUserId) : tokenOk;
    if (!canProceed) {
      send(
        res,
        403,
        {
          "Content-Type": "application/json; charset=utf-8",
          ...(allowOrigin ? { "Access-Control-Allow-Origin": allowOrigin, Vary: "Origin" } : {}),
        },
        JSON.stringify({ error: "No order was completed." })
      );
      return;
    }

    if (userRes.ok && tokenOk && !rowUserId && userId) {
      await supabaseRest(sb, "PATCH", "purchases", {
        query: "id=eq." + encodeURIComponent(String(row?.id || "")),
        headers: { "Content-Type": "application/json", Prefer: "return=minimal" },
        body: JSON.stringify({ user_id: userId, purchaser_email: email || rowEmail || null }),
      }).catch(() => null);
    }
    const status = String(row?.financial_status || "").trim().toLowerCase();
    if (status === "paid" || status === "completed") {
      send(
        res,
        200,
        {
          "Content-Type": "application/json; charset=utf-8",
          ...(allowOrigin ? { "Access-Control-Allow-Origin": allowOrigin, Vary: "Origin" } : {}),
        },
        JSON.stringify({ ok: true, purchase: row, licenseKeys: Array.isArray(row?.license_keys) ? row.license_keys : [] })
      );
      return;
    }

    if (status && status !== "pending") {
      send(
        res,
        403,
        {
          "Content-Type": "application/json; charset=utf-8",
          ...(allowOrigin ? { "Access-Control-Allow-Origin": allowOrigin, Vary: "Origin" } : {}),
        },
        JSON.stringify({ error: "Payment was not completed." })
      );
      return;
    }

    if (!storedToken || !providedToken || storedToken !== providedToken) {
      send(
        res,
        403,
        {
          "Content-Type": "application/json; charset=utf-8",
          ...(allowOrigin ? { "Access-Control-Allow-Origin": allowOrigin, Vary: "Origin" } : {}),
        },
        JSON.stringify({ error: "Payment was not completed." })
      );
      return;
    }

    const purchaseId = String(row?.id || "").trim();
    if (!purchaseId) {
      send(
        res,
        502,
        {
          "Content-Type": "application/json; charset=utf-8",
          ...(allowOrigin ? { "Access-Control-Allow-Origin": allowOrigin, Vary: "Origin" } : {}),
        },
        JSON.stringify({ error: "Missing purchase id" })
      );
      return;
    }

    const nowIso = new Date().toISOString();
    const mark = await supabaseRest(sb, "PATCH", "purchases", {
      query: "id=eq." + encodeURIComponent(purchaseId),
      headers: { "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify({ financial_status: "fulfilling" }),
    });

    if (mark.status < 200 || mark.status >= 300) {
      send(
        res,
        409,
        {
          "Content-Type": "application/json; charset=utf-8",
          ...(allowOrigin ? { "Access-Control-Allow-Origin": allowOrigin, Vary: "Origin" } : {}),
        },
        JSON.stringify({ error: "Order is already being processed." })
      );
      return;
    }

    const storedCart = row?.raw && typeof row.raw === "object" ? row.raw.cart : null;
    const cart = storedCart && typeof storedCart === "object" ? storedCart : payload?.cart && typeof payload.cart === "object" ? payload.cart : null;
    const cartCurrency = String(cart?.currency || row?.currency || "USD").trim().toUpperCase() || "USD";
    const cartItems = Array.isArray(cart?.items) ? cart.items : [];
    const items = cartItems
      .filter((i) => i && typeof i === "object")
      .map((i) => ({
        variantId: String(i.variantId || "").trim(),
        productName: String(i.productName || "").trim(),
        productSlug: String(i.productSlug || "").trim(),
        variantName: String(i.variantName || "").trim(),
        priceCents: Number.isFinite(i.priceCents) ? i.priceCents : 0,
        quantity: Number.isFinite(i.quantity) ? Math.max(1, Math.floor(i.quantity)) : 1,
        imageUrl: String(i.imageUrl || "").trim(),
      }))
      .filter((i) => i.productName && i.quantity > 0);

    if (!items.length) {
      await supabaseRest(sb, "PATCH", "purchases", {
        query: "id=eq." + encodeURIComponent(purchaseId),
        headers: { "Content-Type": "application/json", Prefer: "return=minimal" },
        body: JSON.stringify({ financial_status: "failed" }),
      });
      send(
        res,
        400,
        {
          "Content-Type": "application/json; charset=utf-8",
          ...(allowOrigin ? { "Access-Control-Allow-Origin": allowOrigin, Vary: "Origin" } : {}),
        },
        JSON.stringify({ error: "Cart is empty" })
      );
      return;
    }

    const storeRes = await supabaseRest(sb, "GET", "site_kv", {
      query: "select=value&key=eq.store_config&limit=1",
      headers: { Accept: "application/json" },
    });
    const storeRow = Array.isArray(storeRes.json) ? storeRes.json[0] : null;
    const storeConfig = storeRow && storeRow.value && typeof storeRow.value === "object" ? storeRow.value : null;
    if (!storeConfig) {
      await supabaseRest(sb, "PATCH", "purchases", {
        query: "id=eq." + encodeURIComponent(purchaseId),
        headers: { "Content-Type": "application/json", Prefer: "return=minimal" },
        body: JSON.stringify({ financial_status: "failed" }),
      });
      send(
        res,
        500,
        {
          "Content-Type": "application/json; charset=utf-8",
          ...(allowOrigin ? { "Access-Control-Allow-Origin": allowOrigin, Vary: "Origin" } : {}),
        },
        JSON.stringify({ error: "Missing store_config" })
      );
      return;
    }

    storeConfig.products = Array.isArray(storeConfig.products) ? storeConfig.products : [];

    const allocations = [];
    const lineItems = [];
    const shortages = [];
    const stockLeftMap = {};

    for (const it of items) {
      const slugKey = String(it.productSlug || "").trim().toLowerCase();
      const nameKey = String(it.productName || "").trim().toLowerCase();
      const product =
        (slugKey ? storeConfig.products.find((p) => String(p?.slug || "").trim().toLowerCase() === slugKey) : null) ||
        (nameKey ? storeConfig.products.find((p) => String(p?.name || "").trim().toLowerCase() === nameKey) : null) ||
        null;
      if (!product) {
        shortages.push({ product: it.productName, variant: it.variantName, reason: "Product not found" });
        continue;
      }
      product.variants = Array.isArray(product.variants) ? product.variants : [];
      const variant =
        (it.variantId ? product.variants.find((v) => String(v?.variantId || "").trim() === it.variantId) : null) ||
        (it.variantName
          ? product.variants.find((v) => String(v?.name || "").trim().toLowerCase() === String(it.variantName || "").trim().toLowerCase())
          : null) ||
        null;
      if (!variant) {
        shortages.push({ product: product.slug || it.productName, variant: it.variantName, reason: "Variant not found" });
        continue;
      }
      variant.licenseKeys = normalizeKeysList(variant.licenseKeys);
      const need = it.quantity;
      if (variant.licenseKeys.length < need) {
        shortages.push({
          product: product.slug || it.productName,
          variant: String(variant.name || it.variantName || ""),
          reason: "Out of stock",
          available: variant.licenseKeys.length,
          requested: need,
        });
        continue;
      }
      const taken = variant.licenseKeys.splice(0, need);
      variant.issuedKeys = Array.isArray(variant.issuedKeys) ? variant.issuedKeys : [];
      taken.forEach((k) => {
        variant.issuedKeys.push({ key: k, user_id: userId || null, email: email || null, checkoutSessionId, issued_at: nowIso });
      });
      taken.forEach((k) => allocations.push({ key: k, product_slug: String(product.slug || ""), variant: String(variant.name || "") }));
      stockLeftMap[`${String(product.slug || it.productSlug || "").trim()}|${String(variant.name || it.variantName || "").trim()}`] = Array.isArray(variant.licenseKeys)
        ? variant.licenseKeys.length
        : normalizeKeysList(variant.licenseKeys).length;
      lineItems.push({
        title: String(product.name || it.productName || "Product"),
        variant: String(variant.name || it.variantName || ""),
        quantity: need,
        priceCents: it.priceCents,
        imageUrl: it.imageUrl,
        productSlug: String(product.slug || it.productSlug || ""),
      });
    }

    if (shortages.length) {
      await supabaseRest(sb, "PATCH", "purchases", {
        query: "id=eq." + encodeURIComponent(purchaseId),
        headers: { "Content-Type": "application/json", Prefer: "return=minimal" },
        body: JSON.stringify({ financial_status: "failed" }),
      });
      send(
        res,
        409,
        {
          "Content-Type": "application/json; charset=utf-8",
          ...(allowOrigin ? { "Access-Control-Allow-Origin": allowOrigin, Vary: "Origin" } : {}),
        },
        JSON.stringify({ error: "Cannot fulfill order", shortages })
      );
      return;
    }

    const upsertStore = await supabaseRest(sb, "POST", "site_kv", {
      headers: { "Content-Type": "application/json", Prefer: "resolution=merge-duplicates" },
      body: JSON.stringify({ key: "store_config", value: storeConfig }),
    });
    if (upsertStore.status < 200 || upsertStore.status >= 300) {
      await supabaseRest(sb, "PATCH", "purchases", {
        query: "id=eq." + encodeURIComponent(purchaseId),
        headers: { "Content-Type": "application/json", Prefer: "return=minimal" },
        body: JSON.stringify({ financial_status: "failed" }),
      });
      send(
        res,
        502,
        {
          "Content-Type": "application/json; charset=utf-8",
          ...(allowOrigin ? { "Access-Control-Allow-Origin": allowOrigin, Vary: "Origin" } : {}),
        },
        JSON.stringify({ error: "Failed to update store_config", body: upsertStore.json || upsertStore.text })
      );
      return;
    }

    const totalCents = items.reduce((acc, i) => acc + (Number(i.priceCents) || 0) * (Number(i.quantity) || 1), 0);

    const updated = await supabaseRest(sb, "PATCH", "purchases", {
      query: "id=eq." + encodeURIComponent(purchaseId) + "&select=*",
      headers: { "Content-Type": "application/json", Prefer: "return=representation" },
      body: JSON.stringify({
        financial_status: "paid",
        processed_at: nowIso,
        currency: cartCurrency,
        total_price: Number((Math.max(0, totalCents) / 100).toFixed(2)),
        line_items: lineItems,
        license_keys: allocations,
        payment_provider: "moneymotion",
        provider_checkout_session_id: checkoutSessionId,
        raw: { ...(row?.raw && typeof row.raw === "object" ? row.raw : {}), fulfilled_at: nowIso, cart },
      }),
    });

    if (updated.status < 200 || updated.status >= 300) {
      send(
        res,
        502,
        {
          "Content-Type": "application/json; charset=utf-8",
          ...(allowOrigin ? { "Access-Control-Allow-Origin": allowOrigin, Vary: "Origin" } : {}),
        },
        JSON.stringify({ error: "Failed to update purchase", body: updated.json || updated.text })
      );
      return;
    }

    const saved = Array.isArray(updated.json) ? updated.json[0] : updated.json;
    try {
      const notifCfg = await getNotificationsConfigCached();
      const cfg = normalizeNotificationsConfig(notifCfg);
      if (cfg.enabled && cfg.webhookUrl) {
        const payload = buildDiscordPurchasePayload({
          purchase: saved,
          isLogged: Boolean(userRes.ok && userId),
          purchaserEmail: email || saved?.purchaser_email || "",
          allocations,
          stockLeftMap,
          config: cfg,
        });
        postDiscordWebhook(cfg.webhookUrl, payload).catch(() => null);
      }
    } catch (_) {}
    send(
      res,
      200,
      {
        "Content-Type": "application/json; charset=utf-8",
        ...(allowOrigin ? { "Access-Control-Allow-Origin": allowOrigin, Vary: "Origin" } : {}),
      },
      JSON.stringify({ ok: true, purchase: saved, licenseKeys: allocations })
    );
    return;
  }

  send(
    res,
    403,
    {
      "Content-Type": "application/json; charset=utf-8",
      ...(allowOrigin ? { "Access-Control-Allow-Origin": allowOrigin, Vary: "Origin" } : {}),
    },
    JSON.stringify({ error: "No order was completed." })
  );
};

const handleMoneyMotionDevCheckout = async (req, res) => {
  const origin = String(req.headers.origin || "").trim();
  const host = String(req.headers.host || "").trim();
  const expectedHttp = host ? `http://${host}` : "";
  const expectedHttps = host ? `https://${host}` : "";
  const allowOrigin = origin && (origin === expectedHttp || origin === expectedHttps) ? origin : "";

  const sb = getSupabaseAdmin();
  if (!sb) {
    send(
      res,
      500,
      {
        "Content-Type": "application/json; charset=utf-8",
        ...(allowOrigin ? { "Access-Control-Allow-Origin": allowOrigin, Vary: "Origin" } : {}),
      },
      JSON.stringify({ error: "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY" })
    );
    return;
  }

  const authHeader = String(req.headers.authorization || "").trim();
  const jwt = authHeader.toLowerCase().startsWith("bearer ") ? authHeader.slice(7).trim() : "";
  const userRes = jwt ? await supabaseGetUserFromJwt(sb, jwt) : { ok: false, user: null };

  let payload = null;
  try {
    payload = await readJsonBody(req);
  } catch (_) {
    send(
      res,
      400,
      {
        "Content-Type": "application/json; charset=utf-8",
        ...(allowOrigin ? { "Access-Control-Allow-Origin": allowOrigin, Vary: "Origin" } : {}),
      },
      JSON.stringify({ error: "Invalid JSON body" })
    );
    return;
  }

  const cart = payload?.cart && typeof payload.cart === "object" ? payload.cart : null;
  const cartCurrency = String(cart?.currency || "USD").trim().toUpperCase() || "USD";
  const cartItems = Array.isArray(cart?.items) ? cart.items : [];
  const items = cartItems
    .filter((i) => i && typeof i === "object")
    .map((i) => ({
      title: String(i.productName || "Product").trim(),
      variant: String(i.variantName || "").trim(),
      quantity: Number.isFinite(i.quantity) ? Math.max(1, Math.floor(i.quantity)) : 1,
      priceCents: Number.isFinite(i.priceCents) ? i.priceCents : 0,
      imageUrl: String(i.imageUrl || "").trim(),
      productSlug: String(i.productSlug || "").trim(),
      variantId: String(i.variantId || "").trim(),
    }))
    .filter((i) => i.title && i.quantity > 0);

  if (!items.length) {
    send(
      res,
      400,
      {
        "Content-Type": "application/json; charset=utf-8",
        ...(allowOrigin ? { "Access-Control-Allow-Origin": allowOrigin, Vary: "Origin" } : {}),
      },
      JSON.stringify({ error: "Cart is empty" })
    );
    return;
  }

  const storeConfig = await loadStoreConfigFromSupabase(sb);
  const shortages = computeCartStockShortages(storeConfig, cartItems);
  if (shortages.length) {
    send(
      res,
      409,
      {
        "Content-Type": "application/json; charset=utf-8",
        ...(allowOrigin ? { "Access-Control-Allow-Origin": allowOrigin, Vary: "Origin" } : {}),
      },
      JSON.stringify({ error: "Out of stock", shortages })
    );
    return;
  }

  const userId = userRes.ok ? String(userRes.user?.id || "").trim() : "";
  const email = userRes.ok ? String(userRes.user?.email || "").trim().toLowerCase() : "";
  const nowIso = new Date().toISOString();
  const successToken =
    (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function" && crypto.randomUUID()) ||
    `t-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const checkoutSessionId =
    (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function" && crypto.randomUUID()) ||
    `dev-${Date.now()}-${Math.random().toString(16).slice(2)}`;

  const totalCents = items.reduce((acc, it) => acc + (Number(it.priceCents) || 0) * (Number(it.quantity) || 1), 0);

  const purchaseRow = {
    user_id: userId || null,
    purchaser_email: email || null,
    order_name: "MM-" + String(checkoutSessionId).slice(0, 8),
    financial_status: "pending",
    currency: cartCurrency,
    total_price: Number((Math.max(0, totalCents) / 100).toFixed(2)),
    processed_at: null,
    line_items: items.map((it) => ({
      title: it.title,
      variant: it.variant,
      quantity: it.quantity,
      priceCents: it.priceCents,
      imageUrl: it.imageUrl,
      productSlug: it.productSlug,
      variantId: it.variantId,
    })),
    license_keys: [],
    raw: { payment_provider: "moneymotion", checkoutSessionId, cart, created_at: nowIso, mode: "dev", success_token: successToken },
    payment_provider: "moneymotion",
    provider_checkout_session_id: checkoutSessionId,
  };

  const inserted = await supabaseRest(sb, "POST", "purchases", {
    headers: { "Content-Type": "application/json", Prefer: "return=minimal" },
    body: JSON.stringify(purchaseRow),
  });

  if (inserted.status < 200 || inserted.status >= 300) {
    send(
      res,
      502,
      {
        "Content-Type": "application/json; charset=utf-8",
        ...(allowOrigin ? { "Access-Control-Allow-Origin": allowOrigin, Vary: "Origin" } : {}),
      },
      JSON.stringify({ error: "Failed to create pending purchase", body: inserted.json || inserted.text })
    );
    return;
  }

  send(
    res,
    200,
    {
      "Content-Type": "application/json; charset=utf-8",
      ...(allowOrigin ? { "Access-Control-Allow-Origin": allowOrigin, Vary: "Origin" } : {}),
    },
    JSON.stringify({
      checkoutSessionId,
      successUrl: `${expectedHttps || expectedHttp || "http://localhost:8000"}/success.html?t=${encodeURIComponent(successToken)}&=${encodeURIComponent(
        checkoutSessionId
      )}`,
    })
  );
};

const handleMoneyMotionCheckout = async (req, res) => {
  const origin = String(req.headers.origin || "").trim();
  const host = String(req.headers.host || "").trim();
  const expectedHttp = host ? `http://${host}` : "";
  const expectedHttps = host ? `https://${host}` : "";
  const allowOrigin = origin && (origin === expectedHttp || origin === expectedHttps) ? origin : "";

  const sb = getSupabaseAdmin();
  if (!sb) {
    send(
      res,
      500,
      {
        "Content-Type": "application/json; charset=utf-8",
        ...(allowOrigin ? { "Access-Control-Allow-Origin": allowOrigin, Vary: "Origin" } : {}),
      },
      JSON.stringify({ error: "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY" })
    );
    return;
  }

  const authHeader = String(req.headers.authorization || "").trim();
  const jwt = authHeader.toLowerCase().startsWith("bearer ") ? authHeader.slice(7).trim() : "";
  const userRes = jwt ? await supabaseGetUserFromJwt(sb, jwt) : { ok: false, user: null };
  const userId = userRes.ok ? String(userRes.user?.id || "").trim() : "";
  const authedEmail = userRes.ok ? String(userRes.user?.email || "").trim().toLowerCase() : "";

  const apiKey = String(process.env.MONEY_MOTION_API_KEY || "").trim();
  const createUrl = String(process.env.MONEY_MOTION_CREATE_CHECKOUT_URL || "https://api.moneymotion.io/trpc/checkoutSessions.createCheckoutSession").trim();
  if (!apiKey) {
    send(
      res,
      500,
      {
        "Content-Type": "application/json; charset=utf-8",
        ...(allowOrigin ? { "Access-Control-Allow-Origin": allowOrigin, Vary: "Origin" } : {}),
      },
      JSON.stringify({ error: "Missing MONEY_MOTION_API_KEY" })
    );
    return;
  }
  if (!createUrl) {
    send(
      res,
      500,
      {
        "Content-Type": "application/json; charset=utf-8",
        ...(allowOrigin ? { "Access-Control-Allow-Origin": allowOrigin, Vary: "Origin" } : {}),
      },
      JSON.stringify({ error: "Missing MONEY_MOTION_CREATE_CHECKOUT_URL" })
    );
    return;
  }

  let payload = null;
  try {
    payload = await readJsonBody(req);
  } catch (e) {
    send(
      res,
      400,
      {
        "Content-Type": "application/json; charset=utf-8",
        ...(allowOrigin ? { "Access-Control-Allow-Origin": allowOrigin, Vary: "Origin" } : {}),
      },
      JSON.stringify({ error: "Invalid JSON body" })
    );
    return;
  }

  const toCents = (v) => {
    if (Number.isFinite(v)) {
      if (Number.isInteger(v)) return Math.max(0, Math.round(v));
      return Math.max(0, Math.round(v * 100));
    }
    const s = String(v || "").trim();
    if (!s) return 0;
    const raw = s.replace(/\s+/g, "").replace("€", "").replace("$", "");
    if (/^\d+$/.test(raw)) return Math.max(0, Math.round(Number(raw)));

    const lastComma = raw.lastIndexOf(",");
    const lastDot = raw.lastIndexOf(".");
    let normalized = raw;
    if (lastComma >= 0 && lastDot >= 0) {
      const decimalIsComma = lastComma > lastDot;
      normalized = decimalIsComma ? raw.replace(/\./g, "").replace(",", ".") : raw.replace(/,/g, "");
    } else if (lastComma >= 0) {
      normalized = /^\d{1,3}(,\d{3})+$/.test(raw) ? raw.replace(/,/g, "") : raw.replace(",", ".");
    } else if (lastDot >= 0) {
      normalized = /^\d{1,3}(\.\d{3})+$/.test(raw) ? raw.replace(/\./g, "") : raw;
    }
    normalized = normalized.replace(/[^0-9.]/g, "");
    const n = Number.parseFloat(normalized);
    if (!Number.isFinite(n)) return 0;
    return Math.max(0, Math.round(n * 100));
  };

  const emailFromPayload =
    payload && typeof payload === "object"
      ? String(payload?.customer?.email || payload?.customerEmail || payload?.email || "").trim().toLowerCase()
      : "";
  const email = authedEmail || emailFromPayload;
  const stripWrappingTicks = (v) => {
    const s = String(v || "").trim();
    if (!s) return "";
    const m = s.match(/^[`'"]+([\s\S]*?)[`'"]+$/);
    return (m ? String(m[1] || "") : s).trim();
  };

  const sanitizeUrlInput = (v) => {
    const s0 = stripWrappingTicks(v);
    const s = s0.replace(/\s+/g, "").trim();
    if (!s) return "";
    if (s.toLowerCase().startsWith("javascript:")) return "";
    return s;
  };

  const rawSuccessUrl = sanitizeUrlInput(payload?.successUrl || payload?.urls?.success || "");
  const rawCancelUrl = sanitizeUrlInput(payload?.cancelUrl || payload?.urls?.cancel || "");
  const rawFailureUrl = sanitizeUrlInput(payload?.failureUrl || payload?.urls?.failure || rawCancelUrl || "");
  const baseUrl = expectedHttps || expectedHttp || "http://localhost:8000";
  const toAbsoluteUrl = (value) => {
    const s = String(value || "").trim();
    if (!s) return "";
    if (/^https?:\/\//i.test(s)) return s;
    if (s.startsWith("/")) return baseUrl.replace(/\/+$/, "") + s;
    return baseUrl.replace(/\/+$/, "") + "/" + s.replace(/^\.?\//, "");
  };
  const successUrl = toAbsoluteUrl(rawSuccessUrl);
  const cancelUrl = toAbsoluteUrl(rawCancelUrl);
  const failureUrl = toAbsoluteUrl(rawFailureUrl) || cancelUrl;
  const currencyRaw = String(payload?.currency || payload?.currencyCode || payload?.currency_code || "USD").trim();
  const currency = currencyRaw ? currencyRaw.toUpperCase() : "USD";

  const cart = payload?.cart && typeof payload.cart === "object" ? payload.cart : null;
  const cartItems = Array.isArray(cart?.items) ? cart.items : [];
  if (cartItems.length) {
    const storeConfig = await loadStoreConfigFromSupabase(sb);
    const shortages = computeCartStockShortages(storeConfig, cartItems);
    if (shortages.length) {
      send(
        res,
        409,
        {
          "Content-Type": "application/json; charset=utf-8",
          ...(allowOrigin ? { "Access-Control-Allow-Origin": allowOrigin, Vary: "Origin" } : {}),
        },
        JSON.stringify({ error: "Out of stock", shortages })
      );
      return;
    }
  }

  const withCheckoutIdSuffix = (url) => {
    const s = String(url || "").trim();
    if (!s) return "";
    if (s.endsWith("checkoutSessionId=")) return s;
    if (s.includes("?")) return s + (s.endsWith("?") || s.endsWith("&") ? "" : "&") + "checkoutSessionId=";
    return s + "?checkoutSessionId=";
  };

  const stripCheckoutIdSuffix = (url) => {
    const s = String(url || "").trim();
    if (!s) return "";
    if (s.endsWith("?checkoutSessionId=")) return s.slice(0, -("checkoutSessionId=".length + 1));
    if (s.endsWith("&checkoutSessionId=")) return s.slice(0, -("checkoutSessionId=".length + 1));
    return s;
  };

  const appendQueryParam = (url, key, value) => {
    const base = String(url || "").trim();
    const k = String(key || "").trim();
    const v = String(value || "").trim();
    if (!base || !k) return base;
    const sep = base.includes("?") ? (base.endsWith("?") || base.endsWith("&") ? "" : "&") : "?";
    return base + sep + encodeURIComponent(k) + "=" + encodeURIComponent(v);
  };

  const successToken =
    (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function" && crypto.randomUUID()) ||
    `t-${Date.now()}-${Math.random().toString(16).slice(2)}`;

  const successBase = stripCheckoutIdSuffix(successUrl || `${expectedHttp || "http://localhost:8000"}/success.html`);
  const successWithToken = appendQueryParam(successBase, "t", successToken);

  const rawItems = Array.isArray(payload?.lineItems) ? payload.lineItems : [];
  const lineItems = rawItems
    .map((i) => {
      const name = String(i?.name || i?.productName || "").trim() || "Item";
      const desc = String(i?.description || i?.variantName || "").trim();
      const qty = Number.isFinite(i?.quantity) ? Math.max(1, Math.floor(i.quantity)) : 1;
      const cents = toCents(i?.pricePerItemInCents ?? i?.unitAmount ?? i?.unitAmountInCents ?? i?.priceCents ?? 0);
      return { name, description: desc || "Item", pricePerItemInCents: cents, quantity: qty };
    })
    .filter((x) => x.pricePerItemInCents > 0 && x.quantity > 0);

  if (!lineItems.length) {
    send(
      res,
      400,
      {
        "Content-Type": "application/json; charset=utf-8",
        ...(allowOrigin ? { "Access-Control-Allow-Origin": allowOrigin, Vary: "Origin" } : {}),
      },
      JSON.stringify({ error: "Invalid cart items (missing/zero prices)" })
    );
    return;
  }

  if (!email) {
    send(
      res,
      400,
      {
        "Content-Type": "application/json; charset=utf-8",
        ...(allowOrigin ? { "Access-Control-Allow-Origin": allowOrigin, Vary: "Origin" } : {}),
      },
      JSON.stringify({ error: "Email is required for checkout" })
    );
    return;
  }

  const metadataFromPayload = payload && typeof payload === "object" ? payload?.metadata : null;
  const metadata =
    metadataFromPayload && typeof metadataFromPayload === "object" && !Array.isArray(metadataFromPayload)
      ? metadataFromPayload
      : undefined;

  const mmInput = {
    description: String(payload?.description || "Checkout").trim(),
    urls: {
      success: withCheckoutIdSuffix(successWithToken),
      cancel: withCheckoutIdSuffix(cancelUrl || `${expectedHttp || "http://localhost:8000"}/`),
      failure: withCheckoutIdSuffix(failureUrl || cancelUrl || `${expectedHttp || "http://localhost:8000"}/`),
    },
    ...(metadata ? { metadata } : {}),
    userInfo: { email },
    lineItems,
  };

  const upstreamHeaders = {
    "Content-Type": "application/json",
    Accept: "application/json",
    "User-Agent": `forcecheats/${STATIC_BUST_VERSION}`,
    "x-api-key": apiKey,
    "x-currency": currency,
  };

  const postUpstream = async (url, bodyObjOrNull) => {
    const body = bodyObjOrNull ? JSON.stringify(bodyObjOrNull) : null;
    return await httpsJson(url, { method: "POST", headers: upstreamHeaders, body });
  };

  const postUpstreamRaw = async (url, bodyStringOrNull) => {
    const body = typeof bodyStringOrNull === "string" ? bodyStringOrNull : null;
    return await httpsJson(url, { method: "POST", headers: upstreamHeaders, body });
  };

  const looksLikeTrpcInvalidRequest = (up) => {
    const code = up?.json?.error?.json?.code;
    if (code === -32600) return true;
    const code2 = up?.json?.error?.code;
    if (code2 === -32600) return true;
    const msg = extractErrorText(up?.json || up?.text || "");
    return msg === "is missing" || /is missing/i.test(msg);
  };

  let upstream = null;
  let upstreamAttempt = "";
  let upstreamUsedUrl = "";
  try {
    const proc = "checkoutSessions.createCheckoutSession";
    const trpcUrl = (() => {
      try {
        const u = new URL(createUrl);
        if (/\/trpc\//i.test(u.pathname)) return u.toString();
        return u.origin.replace(/\/+$/, "") + "/trpc/" + proc;
      } catch (_) {
        return "https://api.moneymotion.io/trpc/" + proc;
      }
    })();

    const tryPost = async (url, bodyObjOrNull, attempt) => {
      upstreamAttempt = attempt;
      upstreamUsedUrl = url;
      return await postUpstream(url, bodyObjOrNull);
    };

    const tryPostRaw = async (url, bodyStringOrNull, attempt) => {
      upstreamAttempt = attempt;
      upstreamUsedUrl = url;
      return await postUpstreamRaw(url, bodyStringOrNull);
    };

    const shouldTryNext = (up) => {
      if (!up) return true;
      if (up.status === 400) return looksLikeTrpcInvalidRequest(up);
      if (up.status === 404 || up.status === 405) return true;
      return false;
    };

    upstream = await tryPostRaw(trpcUrl, JSON.stringify(mmInput), "trpc_post_body_raw");
    if (shouldTryNext(upstream)) {
      upstream = await tryPost(trpcUrl, { input: mmInput }, "trpc_post_body_input_wrapper");
    }
    if (shouldTryNext(upstream)) {
      upstream = await tryPost(trpcUrl, { json: mmInput }, "trpc_post_body_json_wrapper");
    }
  } catch (e) {
    send(
      res,
      502,
      {
        "Content-Type": "application/json; charset=utf-8",
        ...(allowOrigin ? { "Access-Control-Allow-Origin": allowOrigin, Vary: "Origin" } : {}),
      },
      JSON.stringify({ error: "Upstream request failed" })
    );
    return;
  }

  if (upstream.status < 200 || upstream.status >= 300) {
    const upstreamBody = upstream.json || upstream.text;
    const upstreamMsg = extractErrorText(upstreamBody) || "Upstream error";
    const detailSuffix =
      upstreamAttempt || upstreamUsedUrl ? ` [attempt=${upstreamAttempt || "?"} url=${upstreamUsedUrl || "?"}]` : "";
    send(
      res,
      502,
      {
        "Content-Type": "application/json; charset=utf-8",
        ...(allowOrigin ? { "Access-Control-Allow-Origin": allowOrigin, Vary: "Origin" } : {}),
      },
      JSON.stringify({
        error: `Upstream error (${upstream.status}): ${upstreamMsg}${detailSuffix}`,
        status: upstream.status,
        serverVersion: STATIC_BUST_VERSION,
        attempt: upstreamAttempt || undefined,
        url: upstreamUsedUrl || undefined,
        upstreamHeaders: upstream.headers || undefined,
        body: upstreamBody,
      })
    );
    return;
  }

  const json = upstream.json;
  const root = Array.isArray(json) ? json[0] : json;
  const checkoutSessionId =
    (root && root.result && root.result.data && root.result.data.json && root.result.data.json.checkoutSessionId) ||
    (root && root.result && root.result.data && root.result.data.checkoutSessionId) ||
    (root && root.checkoutSessionId) ||
    (root && root.data && root.data.checkoutSessionId) ||
    "";

  const checkoutBase = String(process.env.MONEY_MOTION_CHECKOUT_BASE_URL || "https://moneymotion.io/checkout/").trim();
  const checkoutUrlFromId =
    checkoutSessionId && typeof checkoutSessionId === "string"
      ? checkoutBase.replace(/\/+$/, "/") + encodeURIComponent(checkoutSessionId)
      : "";

  const checkoutUrl =
    (root && typeof root.checkoutUrl === "string" && root.checkoutUrl) ||
    (root && typeof root.checkout_url === "string" && root.checkout_url) ||
    (root && typeof root.url === "string" && root.url) ||
    (root && typeof root.session_url === "string" && root.session_url) ||
    (root && typeof root.payment_url === "string" && root.payment_url) ||
    checkoutUrlFromId ||
    extractFirstUrl(root);

  if (!checkoutUrl) {
    send(
      res,
      502,
      {
        "Content-Type": "application/json; charset=utf-8",
        ...(allowOrigin ? { "Access-Control-Allow-Origin": allowOrigin, Vary: "Origin" } : {}),
      },
      JSON.stringify({ error: "Missing checkout URL in response", body: json || upstream.text })
    );
    return;
  }

  if (checkoutSessionId && typeof checkoutSessionId === "string") {
    const storedItems = cartItems
      .filter((i) => i && typeof i === "object")
      .map((i) => ({
        title: String(i.productName || "Product").trim(),
        variant: String(i.variantName || "").trim(),
        quantity: Number.isFinite(i.quantity) ? Math.max(1, Math.floor(i.quantity)) : 1,
        priceCents: Number.isFinite(i.priceCents) ? i.priceCents : 0,
        imageUrl: String(i.imageUrl || "").trim(),
        productSlug: String(i.productSlug || "").trim(),
        variantId: String(i.variantId || "").trim(),
      }))
      .filter((i) => i.title && i.quantity > 0);

    const totalCents = storedItems.reduce((acc, it) => acc + (Number(it.priceCents) || 0) * (Number(it.quantity) || 1), 0);

    const nowIso = new Date().toISOString();
    const purchaseRow = {
      user_id: userId || null,
      purchaser_email: email || null,
      order_name: "MM-" + String(checkoutSessionId).slice(0, 8),
      financial_status: "pending",
      currency,
      total_price: Number((Math.max(0, totalCents) / 100).toFixed(2)),
      processed_at: null,
      line_items: storedItems.length ? storedItems : lineItems.map((li) => ({ title: li.name, quantity: li.quantity, pricePerItemInCents: li.pricePerItemInCents })),
      license_keys: [],
      raw: { payment_provider: "moneymotion", checkoutSessionId, cart, created_at: nowIso, success_token: successToken },
      payment_provider: "moneymotion",
      provider_checkout_session_id: checkoutSessionId,
    };

    const inserted = await supabaseRest(sb, "POST", "purchases", {
      headers: { "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify(purchaseRow),
    });

    if (inserted.status < 200 || inserted.status >= 300) {
      send(
        res,
        502,
        {
          "Content-Type": "application/json; charset=utf-8",
          ...(allowOrigin ? { "Access-Control-Allow-Origin": allowOrigin, Vary: "Origin" } : {}),
        },
        JSON.stringify({ error: "Failed to create pending purchase", body: inserted.json || inserted.text })
      );
      return;
    }
  }

  send(
    res,
    200,
    {
      "Content-Type": "application/json; charset=utf-8",
      ...(allowOrigin ? { "Access-Control-Allow-Origin": allowOrigin, Vary: "Origin" } : {}),
    },
    JSON.stringify({ checkoutUrl })
  );
};

const handleRequest = async (req, res) => {
  try {
    if (!req.url) {
      send(res, 400, { "Content-Type": "text/plain; charset=utf-8" }, "Bad Request");
      return;
    }

    const u = new URL(req.url, `http://127.0.0.1:${PORT}`);
    if (u.pathname === "/api/team/me") {
      if (req.method === "OPTIONS") {
        const origin = String(req.headers.origin || "").trim();
        const host = String(req.headers.host || "").trim();
        const expectedHttp = host ? `http://${host}` : "";
        const expectedHttps = host ? `https://${host}` : "";
        const allowOrigin = origin && (origin === expectedHttp || origin === expectedHttps) ? origin : "";
        send(
          res,
          204,
          {
            Allow: "GET, OPTIONS",
            ...(allowOrigin ? { "Access-Control-Allow-Origin": allowOrigin, Vary: "Origin" } : {}),
            "Access-Control-Allow-Methods": "GET, OPTIONS",
            "Access-Control-Allow-Headers": "Authorization",
            "Access-Control-Max-Age": "600",
          },
          ""
        );
        return;
      }
      if (req.method !== "GET") {
        send(res, 405, { "Content-Type": "text/plain; charset=utf-8" }, "Method Not Allowed");
        return;
      }
      await handleTeamMe(req, res);
      return;
    }
    if (u.pathname === "/api/team/set") {
      if (req.method === "OPTIONS") {
        const origin = String(req.headers.origin || "").trim();
        const host = String(req.headers.host || "").trim();
        const expectedHttp = host ? `http://${host}` : "";
        const expectedHttps = host ? `https://${host}` : "";
        const allowOrigin = origin && (origin === expectedHttp || origin === expectedHttps) ? origin : "";
        send(
          res,
          204,
          {
            Allow: "POST, OPTIONS",
            ...(allowOrigin ? { "Access-Control-Allow-Origin": allowOrigin, Vary: "Origin" } : {}),
            "Access-Control-Allow-Methods": "POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, Authorization",
            "Access-Control-Max-Age": "600",
          },
          ""
        );
        return;
      }
      if (req.method !== "POST") {
        send(res, 405, { "Content-Type": "text/plain; charset=utf-8" }, "Method Not Allowed");
        return;
      }
      await handleTeamSet(req, res);
      return;
    }
    if (u.pathname === "/api/team/list") {
      if (req.method === "OPTIONS") {
        const origin = String(req.headers.origin || "").trim();
        const host = String(req.headers.host || "").trim();
        const expectedHttp = host ? `http://${host}` : "";
        const expectedHttps = host ? `https://${host}` : "";
        const allowOrigin = origin && (origin === expectedHttp || origin === expectedHttps) ? origin : "";
        send(
          res,
          204,
          {
            Allow: "GET, OPTIONS",
            ...(allowOrigin ? { "Access-Control-Allow-Origin": allowOrigin, Vary: "Origin" } : {}),
            "Access-Control-Allow-Methods": "GET, OPTIONS",
            "Access-Control-Allow-Headers": "Authorization",
            "Access-Control-Max-Age": "600",
          },
          ""
        );
        return;
      }
      if (req.method !== "GET") {
        send(res, 405, { "Content-Type": "text/plain; charset=utf-8" }, "Method Not Allowed");
        return;
      }
      await handleTeamList(req, res);
      return;
    }
    if (u.pathname === "/api/team/remove") {
      if (req.method === "OPTIONS") {
        const origin = String(req.headers.origin || "").trim();
        const host = String(req.headers.host || "").trim();
        const expectedHttp = host ? `http://${host}` : "";
        const expectedHttps = host ? `https://${host}` : "";
        const allowOrigin = origin && (origin === expectedHttp || origin === expectedHttps) ? origin : "";
        send(
          res,
          204,
          {
            Allow: "POST, OPTIONS",
            ...(allowOrigin ? { "Access-Control-Allow-Origin": allowOrigin, Vary: "Origin" } : {}),
            "Access-Control-Allow-Methods": "POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, Authorization",
            "Access-Control-Max-Age": "600",
          },
          ""
        );
        return;
      }
      if (req.method !== "POST") {
        send(res, 405, { "Content-Type": "text/plain; charset=utf-8" }, "Method Not Allowed");
        return;
      }
      await handleTeamRemove(req, res);
      return;
    }
    if (u.pathname === "/api/moneymotion/fulfill") {
      if (req.method === "OPTIONS") {
        const origin = String(req.headers.origin || "").trim();
        const host = String(req.headers.host || "").trim();
        const expectedHttp = host ? `http://${host}` : "";
        const expectedHttps = host ? `https://${host}` : "";
        const allowOrigin = origin && (origin === expectedHttp || origin === expectedHttps) ? origin : "";
        send(
          res,
          204,
          {
            Allow: "POST, OPTIONS",
            ...(allowOrigin ? { "Access-Control-Allow-Origin": allowOrigin, Vary: "Origin" } : {}),
            "Access-Control-Allow-Methods": "POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, Authorization",
            "Access-Control-Max-Age": "600",
          },
          ""
        );
        return;
      }
      if (req.method !== "POST") {
        send(res, 405, { "Content-Type": "text/plain; charset=utf-8" }, "Method Not Allowed");
        return;
      }
      await handleMoneyMotionFulfill(req, res);
      return;
    }
    if (u.pathname === "/api/moneymotion/dev-checkout") {
      if (req.method === "OPTIONS") {
        const origin = String(req.headers.origin || "").trim();
        const host = String(req.headers.host || "").trim();
        const expectedHttp = host ? `http://${host}` : "";
        const expectedHttps = host ? `https://${host}` : "";
        const allowOrigin = origin && (origin === expectedHttp || origin === expectedHttps) ? origin : "";
        send(
          res,
          204,
          {
            Allow: "POST, OPTIONS",
            ...(allowOrigin ? { "Access-Control-Allow-Origin": allowOrigin, Vary: "Origin" } : {}),
            "Access-Control-Allow-Methods": "POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, Authorization",
            "Access-Control-Max-Age": "600",
          },
          ""
        );
        return;
      }
      if (req.method !== "POST") {
        send(res, 405, { "Content-Type": "text/plain; charset=utf-8" }, "Method Not Allowed");
        return;
      }
      await handleMoneyMotionDevCheckout(req, res);
      return;
    }
    if (u.pathname === "/api/moneymotion/checkout") {
      if (req.method === "OPTIONS") {
        const origin = String(req.headers.origin || "").trim();
        const host = String(req.headers.host || "").trim();
        const expectedHttp = host ? `http://${host}` : "";
        const expectedHttps = host ? `https://${host}` : "";
        const allowOrigin = origin && (origin === expectedHttp || origin === expectedHttps) ? origin : "";
        send(
          res,
          204,
          {
            Allow: "POST, OPTIONS",
            ...(allowOrigin ? { "Access-Control-Allow-Origin": allowOrigin, Vary: "Origin" } : {}),
            "Access-Control-Allow-Methods": "POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, Authorization",
            "Access-Control-Max-Age": "600",
          },
          ""
        );
        return;
      }
      if (req.method !== "POST") {
        send(res, 405, { "Content-Type": "text/plain; charset=utf-8" }, "Method Not Allowed");
        return;
      }
      await handleMoneyMotionCheckout(req, res);
      return;
    }
    if (u.pathname === "/api/version") {
      if (req.method !== "GET" && req.method !== "HEAD") {
        send(res, 405, { "Content-Type": "text/plain; charset=utf-8" }, "Method Not Allowed");
        return;
      }
      const payload = JSON.stringify({ ok: true, serverVersion: STATIC_BUST_VERSION });
      send(
        res,
        200,
        { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
        req.method === "HEAD" ? "" : payload
      );
      return;
    }

    if (req.method !== "GET" && req.method !== "HEAD") {
      send(res, 405, { "Content-Type": "text/plain; charset=utf-8" }, "Method Not Allowed");
      return;
    }

    const filePath = await resolveRequestToFile(req.url);
    if (!filePath) {
      send(res, 404, { "Content-Type": "text/plain; charset=utf-8" }, "Not Found");
      return;
    }

    if (req.method === "HEAD") {
      const ext = path.extname(filePath).toLowerCase();
      const contentType = MIME_TYPES[ext] || "application/octet-stream";
      send(
        res,
        200,
        {
          "Content-Type": contentType,
          "Cache-Control": ext === ".html" ? "no-store" : "public, max-age=86400"
        },
        ""
      );
      return;
    }

    await serveFile(res, filePath);
  } catch {
    send(res, 500, { "Content-Type": "text/plain; charset=utf-8" }, "Internal Server Error");
  }
};

module.exports = { handleRequest };

if (require.main === module) {
  const server = http.createServer((req, res) => void handleRequest(req, res));
  server.listen(PORT, "::", () => {
    process.stdout.write(`Server running on http://localhost:${PORT}\n`);
  });
}
