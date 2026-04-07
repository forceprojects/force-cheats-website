import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const getEnv = (key: string) => Deno.env.get(key) || "";

const subtleEqual = (a: Uint8Array, b: Uint8Array) => {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a[i] ^ b[i];
  return out === 0;
};

const verifyShopifyHmac = async (rawBody: string, secret: string, header: string) => {
  if (!secret || !header) return false;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(rawBody));
  const computed = btoa(String.fromCharCode(...new Uint8Array(sig)));
  return subtleEqual(new TextEncoder().encode(computed), new TextEncoder().encode(header));
};

const normalizeMoney = (value: unknown) => {
  const s = String(value ?? "").trim();
  if (!s) return null;
  const n = Number.parseFloat(s);
  if (!Number.isFinite(n)) return null;
  return n;
};

const findTokensInString = (value: unknown) => {
  const s = String(value ?? "").trim();
  if (!s) return [];
  const parts = s
    .split(/[\r\n,;|]+/g)
    .map((p) => p.trim())
    .filter(Boolean);
  return parts.length ? parts : [s];
};

const shouldTreatAsLicenseField = (name: string) => {
  const n = name.toLowerCase();
  return (
    n.includes("license") ||
    n.includes("licence") ||
    n.includes("serial") ||
    n.includes("key") ||
    n.includes("download") ||
    n.includes("edp")
  );
};

const extractLicenses = (payload: any, metafields: any[] = []) => {
  const out: Array<{ label?: string; key?: string; source?: string }> = [];

  const pushKey = (label: unknown, rawValue: unknown, source: string) => {
    const labelStr = String(label ?? "").trim() || "License";
    for (const token of findTokensInString(rawValue)) {
      const key = String(token ?? "").trim();
      if (!key) continue;
      out.push({ label: labelStr, key, source });
    }
  };

  const fromProps = (props: any, source: string) => {
    if (!Array.isArray(props)) return;
    for (const p of props) {
      const rawName = p?.name ?? p?.key ?? "";
      const name = String(rawName ?? "");
      const value = p?.value ?? "";
      if (!value) continue;
      if (shouldTreatAsLicenseField(name)) {
        pushKey(rawName, value, source);
      }
    }
  };

  const items = Array.isArray(payload?.line_items) ? payload.line_items : [];
  for (const li of items) {
    fromProps(li?.properties, "line_item.properties");
  }

  fromProps(Array.isArray(payload?.note_attributes) ? payload.note_attributes : [], "note_attributes");

  for (const mf of Array.isArray(metafields) ? metafields : []) {
    const ns = String(mf?.namespace ?? "");
    const key = String(mf?.key ?? "");
    const label = ns && key ? `${ns}.${key}` : key || ns || "metafield";
    const name = label;
    const value = mf?.value ?? "";
    if (!value) continue;
    if (shouldTreatAsLicenseField(name)) {
      pushKey(label, value, "metafields");
    }
  }

  const uniq = new Set<string>();
  return out.filter((k) => {
    const sig = `${k.label || ""}::${k.key || ""}`;
    if (uniq.has(sig)) return false;
    uniq.add(sig);
    return true;
  });
};

const fetchJson = async (url: string, headers: Record<string, string>) => {
  const res = await fetch(url, { method: "GET", headers });
  const text = await res.text();
  let json: any = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = null;
  }
  if (!res.ok) {
    const message = json?.errors || json?.error || text || `HTTP ${res.status}`;
    throw new Error(String(message));
  }
  return json;
};

const isUuid = (value: unknown) => {
  const s = String(value ?? "").trim().toLowerCase();
  if (!s) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(s);
};

const getNoteAttributeValue = (payload: any, key: string) => {
  const attrs = Array.isArray(payload?.note_attributes) ? payload.note_attributes : [];
  const needle = String(key || "").trim().toLowerCase();
  for (const a of attrs) {
    const name = String(a?.name ?? a?.key ?? "").trim().toLowerCase();
    if (!name) continue;
    if (name !== needle) continue;
    const value = a?.value ?? "";
    const s = String(value ?? "").trim();
    if (s) return s;
  }
  return "";
};

const getLineItemPropertyValue = (payload: any, key: string) => {
  const needle = String(key || "").trim().toLowerCase();
  const items = Array.isArray(payload?.line_items) ? payload.line_items : [];
  for (const li of items) {
    const props = Array.isArray(li?.properties) ? li.properties : [];
    for (const p of props) {
      const name = String(p?.name ?? p?.key ?? "").trim().toLowerCase();
      if (!name) continue;
      if (name !== needle) continue;
      const value = p?.value ?? "";
      const s = String(value ?? "").trim();
      if (s) return s;
    }
  }
  return "";
};

const findSupabaseUserIdByEmail = async (supabaseUrl: string, serviceRoleKey: string, email: string) => {
  const normalized = String(email || "").trim().toLowerCase();
  if (!normalized) return null;

  const url = `${supabaseUrl}/auth/v1/admin/users?email=${encodeURIComponent(normalized)}&page=1&per_page=1`;
  const res = await fetch(url, {
    method: "GET",
    headers: {
      "Authorization": `Bearer ${serviceRoleKey}`,
      "apikey": serviceRoleKey,
      "Content-Type": "application/json",
    },
  });

  const text = await res.text();
  let json: any = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = null;
  }

  if (!res.ok) return null;
  const users = Array.isArray(json?.users) ? json.users : [];
  const id = users?.[0]?.id;
  return typeof id === "string" && id ? id : null;
};

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    console.log("shopify-orders-paid: method not allowed", req.method);
    return new Response("Method Not Allowed", { status: 405 });
  }

  const supabaseUrl = getEnv("SUPABASE_URL");
  const supabaseServiceRoleKey = getEnv("SUPABASE_SERVICE_ROLE_KEY");
  const shopifySecret = getEnv("SHOPIFY_WEBHOOK_SECRET");
  const shopifyAdminAccessToken = getEnv("SHOPIFY_ADMIN_ACCESS_TOKEN");
  const shopifyAdminDomain = getEnv("SHOPIFY_ADMIN_DOMAIN") || "kyloprojects.com";
  const shopifyAdminApiVersion = getEnv("SHOPIFY_ADMIN_API_VERSION") || "2026-01";

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    console.log("shopify-orders-paid: missing supabase env", {
      hasUrl: Boolean(supabaseUrl),
      hasServiceRole: Boolean(supabaseServiceRoleKey),
    });
    return new Response("Missing Supabase env", { status: 500 });
  }
  if (!shopifySecret) {
    console.log("shopify-orders-paid: missing SHOPIFY_WEBHOOK_SECRET");
    return new Response("Missing Shopify env", { status: 500 });
  }

  const rawBody = await req.text();
  const hmacHeader = req.headers.get("X-Shopify-Hmac-Sha256") || "";
  const ok = await verifyShopifyHmac(rawBody, shopifySecret, hmacHeader);
  if (!ok) {
    console.log("shopify-orders-paid: hmac verification failed", {
      hasHmacHeader: Boolean(hmacHeader),
      topic: req.headers.get("X-Shopify-Topic") || "",
      shop: req.headers.get("X-Shopify-Shop-Domain") || "",
      webhookId: req.headers.get("X-Shopify-Webhook-Id") || "",
    });
    return new Response("Unauthorized", { status: 401 });
  }

  let payload: any = null;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    console.log("shopify-orders-paid: invalid json body");
    return new Response("Bad Request", { status: 400 });
  }

  const purchaserEmail = String(payload?.email || payload?.customer?.email || "").trim().toLowerCase() || null;
  const orderIdRaw = payload?.id;
  const orderId = typeof orderIdRaw === "number" ? orderIdRaw : Number.parseInt(String(orderIdRaw || ""), 10);
  if (!Number.isFinite(orderId)) return new Response("Missing order id", { status: 400 });

  const orderName = String(payload?.name || payload?.order_number || payload?.orderNumber || "").trim() || null;
  const financialStatus = String(payload?.financial_status || payload?.display_financial_status || "").trim() || null;
  const currency = String(payload?.currency || "").trim() || null;
  const totalPrice =
    normalizeMoney(payload?.current_total_price) ??
    normalizeMoney(payload?.total_price) ??
    normalizeMoney(payload?.current_total_price_set?.shop_money?.amount) ??
    null;

  const lineItems = Array.isArray(payload?.line_items)
    ? payload.line_items.map((li: any) => ({
      title: li?.title ?? li?.name ?? null,
      quantity: li?.quantity ?? 1,
      sku: li?.sku ?? null,
      product_id: li?.product_id ?? null,
      variant_id: li?.variant_id ?? null,
      price: li?.price ?? null,
    }))
    : [];

  let metafields: any[] = [];
  if (shopifyAdminAccessToken) {
    try {
      const base = `https://${shopifyAdminDomain}/admin/api/${shopifyAdminApiVersion}`;
      const headers = {
        "X-Shopify-Access-Token": shopifyAdminAccessToken,
        "Accept": "application/json",
      };
      const mf = await fetchJson(`${base}/orders/${orderId}/metafields.json`, headers);
      metafields = Array.isArray(mf?.metafields) ? mf.metafields : [];
    } catch (e) {
      console.log("shopify-orders-paid: failed to fetch metafields", {
        orderId,
        message: e instanceof Error ? e.message : String(e),
      });
    }
  }

  const licenses = extractLicenses(payload, metafields);

  const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);
  let userId: string | null = null;
  const claimedUserId =
    getNoteAttributeValue(payload, "kylo_supabase_user_id") ||
    getLineItemPropertyValue(payload, "kylo_supabase_user_id");
  if (isUuid(claimedUserId)) {
    userId = claimedUserId;
  } else if (purchaserEmail) {
    try {
      userId = await findSupabaseUserIdByEmail(supabaseUrl, supabaseServiceRoleKey, purchaserEmail);
    } catch (_) {
      userId = null;
    }
  }

  const upsertRow: Record<string, unknown> = {
    purchaser_email: purchaserEmail,
    shopify_order_id: orderId,
    order_name: orderName,
    financial_status: financialStatus,
    currency,
    total_price: totalPrice,
    processed_at: payload?.processed_at ?? payload?.created_at ?? null,
    created_at: payload?.created_at ?? null,
    line_items: lineItems,
    license_keys: licenses,
    raw: payload,
  };
  if (userId) upsertRow.user_id = userId;

  const { error } = await supabase.from("purchases").upsert(
    upsertRow,
    { onConflict: "shopify_order_id" },
  );

  if (error) {
    console.log("shopify-orders-paid: db error", { code: error.code, message: error.message });
    return new Response("DB error", { status: 500 });
  }

  if (userId) {
    try {
      const { error: profileError } = await supabase.from("profiles").upsert(
        {
          id: userId,
          email: purchaserEmail,
          role: "customer",
          reputation: 2,
        },
        { onConflict: "id" },
      );
      if (profileError) {
        console.log("shopify-orders-paid: profile role update failed", {
          code: profileError.code,
          message: profileError.message,
          userId,
        });
      }
    } catch (e) {
      console.log("shopify-orders-paid: profile role update exception", {
        userId,
        message: e instanceof Error ? e.message : String(e),
      });
    }
  }

  console.log("shopify-orders-paid: ok", { orderId, purchaserEmail, userId });
  return new Response("ok", { status: 200 });
});
