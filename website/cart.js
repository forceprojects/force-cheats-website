(function () {
  const STORAGE_KEY = "kylo_cart_v1";
  const DEFAULT_CURRENCY = "USD";
  const SHOPIFY_STOREFRONT_ACCESS_TOKEN = "f6839a91153bf46bcc9e3b421db0e0c1";
  const SHOPIFY_API_VERSION = "2025-01";
  const SHOPIFY_STORE_DOMAIN = "kyloprojects.com";
  const SHOPIFY_STOREFRONT_ENDPOINT = `https://${SHOPIFY_STORE_DOMAIN}/api/${SHOPIFY_API_VERSION}/graphql.json`;
  const SUPABASE_PROJECT_REF = "tjpxmbfekgnxtyujvyvx";
  const SUPABASE_AUTH_TOKEN_KEY = `sb-${SUPABASE_PROJECT_REF}-auth-token`;
  const CHECKOUT_CONFIG_KEY = "checkout_config";
  const VALID_VARIANT_IDS = new Set([
    "53167992439123",
    "53167992471891",
    "53167992504659",
    "53167992537427",
    "53167992570195",
    "53167397273939",
    "53167397306707",
    "53167397339475",
    "53167397372243",
    "53167397405011",
    "53168284041555",
    "53168284074323",
    "53168284107091",
    "53044213809491",
    "53044213875027",
  ]);

  const parsePriceToCents = (price) => {
    if (typeof price !== "string") return 0;
    const normalized = price
      .replace(/\s+/g, "")
      .replace("€", "")
      .replace("$", "")
      .replace(",", ".")
      .replace(/[^0-9.]/g, "");
    const value = Number.parseFloat(normalized);
    if (!Number.isFinite(value)) return 0;
    return Math.round(value * 100);
  };

  const formatCents = (cents, currency = DEFAULT_CURRENCY) => {
    const amount = (Math.max(0, cents) / 100).toFixed(2);
    if (currency === "USD") return `$${amount}`;
    return amount;
  };

  const getSupabaseUserEmail = () => {
    try {
      const rawExact = localStorage.getItem(SUPABASE_AUTH_TOKEN_KEY);
      if (rawExact) {
        const parsed = JSON.parse(rawExact);
        const email = parsed?.user?.email || parsed?.currentSession?.user?.email || parsed?.session?.user?.email;
        const normalized = String(email || "").trim().toLowerCase();
        if (normalized) return normalized;
      }
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!key) continue;
        if (!key.startsWith("sb-") || !key.endsWith("-auth-token")) continue;
        const raw = localStorage.getItem(key);
        if (!raw) continue;
        const parsed = JSON.parse(raw);
        const email = parsed?.user?.email || parsed?.currentSession?.user?.email || parsed?.session?.user?.email;
        const normalized = String(email || "").trim().toLowerCase();
        if (normalized) return normalized;
      }
    } catch (_) {}
    return "";
  };

  const getSupabaseUserId = () => {
    try {
      const rawExact = localStorage.getItem(SUPABASE_AUTH_TOKEN_KEY);
      if (rawExact) {
        const parsed = JSON.parse(rawExact);
        const id = parsed?.user?.id || parsed?.currentSession?.user?.id || parsed?.session?.user?.id;
        const normalized = String(id || "").trim();
        if (normalized) return normalized;
      }
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!key) continue;
        if (!key.startsWith("sb-") || !key.endsWith("-auth-token")) continue;
        const raw = localStorage.getItem(key);
        if (!raw) continue;
        const parsed = JSON.parse(raw);
        const id = parsed?.user?.id || parsed?.currentSession?.user?.id || parsed?.session?.user?.id;
        const normalized = String(id || "").trim();
        if (normalized) return normalized;
      }
    } catch (_) {}
    return "";
  };

  const loadCart = () => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return { currency: DEFAULT_CURRENCY, items: [] };
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") return { currency: DEFAULT_CURRENCY, items: [] };
      const currency = typeof parsed.currency === "string" ? parsed.currency : DEFAULT_CURRENCY;
      const items = Array.isArray(parsed.items) ? parsed.items : [];
      return {
        currency,
        items: items
          .filter((i) => i && typeof i === "object")
          .map((i) => ({
            variantId: String(i.variantId ?? ""),
            productName: String(i.productName ?? ""),
            productSlug: String(i.productSlug ?? ""),
            variantName: String(i.variantName ?? ""),
            priceCents: Number.isFinite(i.priceCents) ? i.priceCents : 0,
            quantity: Number.isFinite(i.quantity) ? i.quantity : 1,
            imageUrl: typeof i.imageUrl === "string" ? i.imageUrl : "",
          }))
          .filter((i) => i.variantId && i.productName && i.quantity > 0),
      };
    } catch {
      return { currency: DEFAULT_CURRENCY, items: [] };
    }
  };

  const saveCart = (cart) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cart));
  };

  const upsertItem = (cart, nextItem) => {
    const variantId = String(nextItem.variantId ?? "");
    const quantity = Number.isFinite(nextItem.quantity) ? nextItem.quantity : 1;
    if (!variantId || quantity <= 0) return cart;

    const existingIndex = cart.items.findIndex((i) => i.variantId === variantId);
    const priceCents =
      Number.isFinite(nextItem.priceCents) && nextItem.priceCents >= 0
        ? nextItem.priceCents
        : parsePriceToCents(String(nextItem.price ?? ""));

    const normalized = {
      variantId,
      productName: String(nextItem.productName ?? ""),
      productSlug: String(nextItem.productSlug ?? ""),
      variantName: String(nextItem.variantName ?? ""),
      priceCents,
      quantity,
      imageUrl: typeof nextItem.imageUrl === "string" ? nextItem.imageUrl : "",
    };

    if (existingIndex >= 0) {
      cart.items[existingIndex] = {
        ...cart.items[existingIndex],
        ...normalized,
        quantity: cart.items[existingIndex].quantity + quantity,
      };
      return cart;
    }

    cart.items.push(normalized);
    return cart;
  };

  const getTotals = (cart) => {
    const count = cart.items.reduce((acc, i) => acc + (Number.isFinite(i.quantity) ? i.quantity : 0), 0);
    const subtotalCents = cart.items.reduce((acc, i) => acc + i.priceCents * i.quantity, 0);
    return { count, subtotalCents };
  };

  const shopifyRequest = async (endpoint, query, variables) => {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Storefront-Access-Token": SHOPIFY_STOREFRONT_ACCESS_TOKEN,
      },
      body: JSON.stringify({ query, variables }),
    });

    let json = null;
    try {
      json = await res.json();
    } catch {
      json = null;
    }

    if (!res.ok) {
      const shopifyMessage = json?.errors?.[0]?.message;
      throw new Error(shopifyMessage ? `Shopify: ${shopifyMessage}` : `Shopify request failed: ${res.status}`);
    }

    const errors = Array.isArray(json?.errors) ? json.errors : [];
    if (errors.length) {
      throw new Error(String(errors[0]?.message ?? "Shopify error"));
    }

    return json;
  };

  const createShopifyCheckoutUrl = async (cart) => {
    const email = getSupabaseUserEmail();
    const userId = getSupabaseUserId();
    const attributes = userId ? [{ key: "kylo_supabase_user_id", value: userId }] : [];
    const lineAttributes = attributes.length ? attributes : undefined;

    const lines = cart.items.map((i) => ({
      merchandiseId: `gid://shopify/ProductVariant/${i.variantId}`,
      quantity: i.quantity,
      ...(lineAttributes ? { attributes: lineAttributes } : {}),
    }));

    const query = `
      mutation cartCreate($input: CartInput!) {
        cartCreate(input: $input) {
          cart {
            checkoutUrl
          }
          userErrors {
            field
            message
          }
        }
      }
    `;

    const input = email
      ? { lines, buyerIdentity: { email }, attributes }
      : attributes.length
        ? { lines, attributes }
        : { lines };
    const json = await shopifyRequest(SHOPIFY_STOREFRONT_ENDPOINT, query, { input });
    const userErrors = json?.data?.cartCreate?.userErrors ?? [];
    if (Array.isArray(userErrors) && userErrors.length) {
      throw new Error(String(userErrors[0]?.message ?? "Shopify user error"));
    }
    const checkoutUrl = json?.data?.cartCreate?.cart?.checkoutUrl;
    if (typeof checkoutUrl !== "string" || !checkoutUrl) {
      throw new Error("Missing checkoutUrl");
    }
    return checkoutUrl;
  };

  const normalizeCheckoutConfig = (input) => {
    const cfg = input && typeof input === "object" ? input : {};
    const provider = String(cfg.provider || "").trim().toLowerCase() || "moneymotion";
    const enabled = Boolean(cfg.enabled);
    const devMode = Boolean(cfg.devMode);
    const successUrl = typeof cfg.successUrl === "string" ? cfg.successUrl.trim() : "";
    const cancelUrl = typeof cfg.cancelUrl === "string" ? cfg.cancelUrl.trim() : "";
    return { provider, enabled, devMode, successUrl, cancelUrl };
  };

  const loadCheckoutConfig = async () => {
    const sb = await ensureSupabase();
    if (!sb) return normalizeCheckoutConfig(null);
    try {
      const { data, error } = await sb.from("site_kv").select("value").eq("key", CHECKOUT_CONFIG_KEY).maybeSingle();
      if (error) return normalizeCheckoutConfig(null);
      return normalizeCheckoutConfig(data?.value);
    } catch (_) {
      return normalizeCheckoutConfig(null);
    }
  };

  const createMoneyMotionCheckoutUrl = async (cart, checkoutConfig) => {
    const configuredSuccess = checkoutConfig?.successUrl || "";
    const defaultSuccess = `${window.location.origin}/success.html`;
    const cancelUrl = checkoutConfig?.cancelUrl || window.location.href;
    const sb = await ensureSupabase();
    if (!sb) throw new Error("Supabase is not configured.");
    const { data } = await sb.auth.getSession();
    const token = data?.session?.access_token || "";
    const email = getSupabaseUserEmail();
    const userId = getSupabaseUserId();
    const successUrl = !token && /purchases\.html/i.test(configuredSuccess) ? defaultSuccess : (configuredSuccess || defaultSuccess);

    const lineItems = cart.items.map((i) => ({
      variantId: String(i.variantId || ""),
      name: String(i.productName || ""),
      variantName: String(i.variantName || ""),
      quantity: i.quantity,
      unitAmount: i.priceCents,
      imageUrl: String(i.imageUrl || ""),
    }));

    const payload = {
      currency: cart.currency,
      successUrl,
      cancelUrl,
      customer: email ? { email } : undefined,
      metadata: userId || email ? { ...(userId ? { kylo_supabase_user_id: userId } : {}), ...(email ? { email } : {}) } : undefined,
      lineItems,
      cart,
    };

    const res = await fetch("/api/moneymotion/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify(payload),
    });

    let json = null;
    try {
      json = await res.json();
    } catch (_) {
      json = null;
    }

    if (!res.ok) {
      const base = typeof json?.error === "string" && json.error ? json.error : `Checkout failed: ${res.status}`;
      let details = "";
      try {
        if (json && typeof json === "object" && Array.isArray(json.shortages) && json.shortages.length) {
          details = json.shortages
            .map((s) => {
              const p = String(s?.product || "").trim();
              const v = String(s?.variant || "").trim();
              const r = String(s?.reason || "").trim();
              const a = typeof s?.available === "number" ? ` (available: ${s.available})` : "";
              const q = typeof s?.requested === "number" ? ` (requested: ${s.requested})` : "";
              return [p && `Product: ${p}`, v && `Variant: ${v}`, r && `Reason: ${r}${a}${q}`].filter(Boolean).join(" | ");
            })
            .filter(Boolean)
            .join("\n");
        }
        if (json && typeof json === "object" && "body" in json) {
          const body = json.body;
          if (typeof body === "string" && body.trim()) details = body.trim();
          else if (body && typeof body === "object") details = JSON.stringify(body);
        }
      } catch (_) {}
      throw new Error(details ? `${base}\n${details}` : base);
    }

    const checkoutUrl = json?.checkoutUrl;
    if (typeof checkoutUrl !== "string" || !checkoutUrl) {
      let extra = "";
      try {
        extra = json && typeof json === "object" ? JSON.stringify(json) : "";
      } catch (_) {
        extra = "";
      }
      throw new Error(extra ? `Missing checkoutUrl\n${extra}` : "Missing checkoutUrl");
    }
    return checkoutUrl;
  };

  const resolveUrl = (value) => {
    const s = String(value || "").trim();
    if (!s) return "";
    if (/^https?:\/\//i.test(s)) return s;
    if (s.startsWith("/")) return window.location.origin + s;
    return window.location.origin + "/" + s.replace(/^\.?\//, "");
  };

  const appendCheckoutIdParam = (baseUrl, checkoutId) => {
    const base = String(baseUrl || "").trim();
    const id = encodeURIComponent(String(checkoutId || "").trim());
    if (!base || !id) return base;
    if (base.endsWith("?=") || base.endsWith("&=") || base.endsWith("=")) return base + id;
    if (base.includes("?")) return base + (base.endsWith("?") || base.endsWith("&") ? "=" : "&=") + id;
    return base + "?=" + id;
  };

  const beginCheckout = async () => {
    try {
      const cart = loadCart();
      const checkoutConfig = await loadCheckoutConfig();
      const useMoneyMotion = checkoutConfig.enabled && checkoutConfig.provider === "moneymotion";

      if (typeof window.kyloRenderCart === "function") {
        window.kyloRenderCart();
      }
      if (!cart.items.length) {
        alert("Your cart is empty.");
        return;
      }

      const checkoutCart = useMoneyMotion
        ? cart
        : {
            ...cart,
            items: cart.items.filter((i) => VALID_VARIANT_IDS.has(String(i.variantId || ""))),
          };

      if (!checkoutCart.items.length) {
        alert("This item is not configured for checkout.");
        return;
      }

      if (useMoneyMotion && checkoutConfig.devMode) {
        const sb = await ensureSupabase();
        if (!sb) throw new Error("Supabase is not configured.");
        const { data } = await sb.auth.getSession();
        const token = data?.session?.access_token || "";

        const res = await fetch("/api/moneymotion/dev-checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
          body: JSON.stringify({ cart: checkoutCart }),
        });
        const json = await res.json().catch(() => null);
        if (!res.ok) {
          const msg = typeof json?.error === "string" && json.error ? json.error : `Checkout failed: ${res.status}`;
          throw new Error(msg);
        }
        const checkoutId = String(json?.checkoutSessionId || "").trim();
        if (!checkoutId) throw new Error("Missing checkoutSessionId");
        const successUrl =
          typeof json?.successUrl === "string" && json.successUrl.trim()
            ? json.successUrl.trim()
            : appendCheckoutIdParam("http://localhost:8000/success", checkoutId);
        closeAddedModal();
        toggleCartMenu(false);
        window.location.assign(successUrl);
        return;
      }

      closeAddedModal();
      toggleCartMenu(false);
      const checkoutUrl = useMoneyMotion
        ? await createMoneyMotionCheckoutUrl(checkoutCart, checkoutConfig)
        : await createShopifyCheckoutUrl(checkoutCart);
      window.location.assign(checkoutUrl);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Checkout failed. Please try again.";
      console.error(err);
      alert(message);
    }
  };

  const ensureStyles = () => {
    if (document.getElementById("kyloCartStyles")) return;
    const style = document.createElement("style");
    style.id = "kyloCartStyles";
    style.textContent = `
      #elCart_container{ position: relative; }
      #elCart{
        position: relative;
        display:inline-flex;
        width:38px;
        height:38px;
        align-items:center;
        justify-content:center;
        border-radius:8px;
        background: rgba(255,255,255,0.06);
        text-decoration:none;
      }
      #elCart:hover{ background: rgba(255,255,255,0.09); }
      #elCart i{ font-size:16px; line-height:1; }
      #elCart_menu{
        position:absolute;
        top: calc(100% + 10px);
        right: 0;
        left: auto;
        margin-top: 0;
        z-index: 10060;
      }
      #elCart_menu, #elCart_menu .ipsMenu_innerContent{
        scrollbar-width: none;
        -ms-overflow-style: none;
      }
      #elCart_menu::-webkit-scrollbar, #elCart_menu .ipsMenu_innerContent::-webkit-scrollbar{
        width: 0;
        height: 0;
      }
      #elCart [data-role="cartCount"]{
        display:inline-flex;
        align-items:center;
        justify-content:center;
        position:absolute;
        top:-6px;
        right:-6px;
        min-width:16px;
        height:16px;
        padding:0 4px;
        border-radius:999px;
        background:var(--theme-brand_accent_hex,#1d68d7);
        color:#fff;
        font-size:10px;
        font-weight:700;
        line-height:16px;
        pointer-events:none;
      }
      #elCart_menu .cNexusPrice strong{
        color:var(--theme-brand_accent_hex,#1d68d7);
      }
      #elCart_menu [data-action="cartRemove"]{
        display:inline-flex;
        width:28px;
        height:28px;
        align-items:center;
        justify-content:center;
        border-radius:6px;
        color:rgba(255,255,255,0.75);
        text-decoration:none;
        background:transparent;
        border:none;
        padding:0;
        cursor:pointer;
        transition: background 120ms ease, color 120ms ease;
      }
      #elCart_menu [data-action="cartRemove"]:hover{
        background: rgba(255,255,255,0.06);
        color:#fff;
      }
      #elCart_menu [data-action="cartRemove"]:focus{
        outline: none;
      }
      #kyloAddedToCartOverlay{
        position:fixed;
        inset:0;
        display:flex;
        align-items:flex-start;
        justify-content:center;
        padding-top:32px;
        background:rgba(0,0,0,.6);
        z-index:10050;
        opacity:0;
        visibility:hidden;
        pointer-events:none;
        transition: opacity 180ms ease, visibility 0s linear 180ms;
      }
      #kyloAddedToCartOverlay.is-open{
        opacity:1;
        visibility:visible;
        pointer-events:auto;
        transition: opacity 180ms ease;
      }
      #kyloAddedToCartModal{
        width:min(520px, calc(100vw - 32px));
        background: rgba(23, 25, 33, 0.96);
        border: none;
        border-radius: 6px;
        box-shadow: 0 18px 60px rgba(0,0,0,0.55);
        transform:translateY(-24px);
        opacity:0;
        transition:transform 180ms ease, opacity 180ms ease;
      }
      #kyloAddedToCartOverlay.is-open #kyloAddedToCartModal{
        transform:translateY(0);
        opacity:1;
      }
      #kyloCheckoutAuthOverlay{
        position:fixed;
        inset:0;
        display:flex;
        align-items:flex-start;
        justify-content:center;
        padding-top:32px;
        background:rgba(0,0,0,.6);
        z-index:10055;
        opacity:0;
        visibility:hidden;
        pointer-events:none;
        transition: opacity 180ms ease, visibility 0s linear 180ms;
      }
      #kyloCheckoutAuthOverlay.is-open{
        opacity:1;
        visibility:visible;
        pointer-events:auto;
        transition: opacity 180ms ease;
      }
      #kyloCheckoutAuthModal{
        width:min(860px, calc(100vw - 32px));
        background: rgb(23, 25, 33);
        border: none;
        border-radius: 6px;
        box-shadow: 0 18px 60px rgba(0,0,0,0.55);
        transform:translateY(-24px);
        opacity:0;
        transition:transform 180ms ease, opacity 180ms ease;
      }
      #kyloCheckoutAuthTitle{ color: rgba(255,255,255,0.96); margin: 0 0 14px 0; text-align:left; }
      #kyloCheckoutAuthOverlay.is-open #kyloCheckoutAuthModal{
        transform:translateY(0);
        opacity:1;
      }
      #kyloCheckoutAuthModal .kyloCheckoutAuthClose{
        position:absolute;
        top:10px;
        right:10px;
        width:34px;
        height:34px;
        display:inline-flex;
        align-items:center;
        justify-content:center;
        border-radius:10px;
        background: rgba(255,255,255,0.08);
        border:0;
        cursor:pointer;
        color: rgba(255,255,255,0.85);
      }
      #kyloCheckoutAuthModal .kyloCheckoutAuthClose:hover{ background: rgba(255,255,255,0.12); color:#fff; }
      #kyloCheckoutAuthError{margin-top:10px;color:#ef4444;font-weight:700}
    `;
    document.head.appendChild(style);
  };

  const ensureAddedModal = () => {
    if (document.getElementById("kyloAddedToCartOverlay")) return;

    const overlay = document.createElement("div");
    overlay.id = "kyloAddedToCartOverlay";

    overlay.innerHTML = `
      <div id="kyloAddedToCartModal" class="ipsPad">
        <div class="ipsAreaBackground_light ipsPad ipsType_center ipsSpacer_bottom">
          <h3 class="ipsType_sectionHead ipsType_center ipsSpacer_bottom ipsSpacer_half ipsType_success">
            <i class="fa fa-check-circle-o"></i> Added to cart
          </h3>
          <h4 class="ipsType_reset ipsType_large" data-role="addedTitle"></h4>
          <p class="ipsType_reset ipsType_medium" data-role="addedQty"></p>
        </div>
        <ul class="ipsGrid ipsGrid_collapsePhone">
          <li class="ipsGrid_span6">
            <a href="#" data-action="kyloAddedClose" class="ipsButton ipsButton_fullWidth ipsButton_light ipsButton_medium">Continue Shopping</a>
          </li>
          <li class="ipsGrid_span6">
            <a href="#" data-action="cartCheckout" class="ipsButton ipsButton_fullWidth ipsButton_primary ipsButton_medium">Review &amp; Checkout</a>
          </li>
        </ul>
      </div>
    `;

    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) closeAddedModal();
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeAddedModal();
    });

    overlay.addEventListener("click", (e) => {
      const target = e.target instanceof Element ? e.target.closest('[data-action="kyloAddedClose"]') : null;
      if (!target) return;
      e.preventDefault();
      closeAddedModal();
    });

    document.body.appendChild(overlay);
  };

  const openAddedModal = ({ productName, variantName, quantity }) => {
    ensureStyles();
    ensureAddedModal();
    const overlay = document.getElementById("kyloAddedToCartOverlay");
    if (!overlay) return;
    const title = overlay.querySelector('[data-role="addedTitle"]');
    const qty = overlay.querySelector('[data-role="addedQty"]');
    if (title) title.textContent = `${productName}${variantName ? ` — ${variantName}` : ""}`;
    if (qty) qty.textContent = `Quantity: ${quantity}`;
    overlay.classList.add("is-open");
  };

  const closeAddedModal = () => {
    const overlay = document.getElementById("kyloAddedToCartOverlay");
    if (!overlay) return;
    overlay.classList.remove("is-open");
  };

  const FALLBACK_SUPABASE_URL = "https://tjpxmbfekgnxtyujvyvx.supabase.co";
  const FALLBACK_SUPABASE_ANON_KEY = "sb_publishable_MY0T9tn8TU567ZRsnoZHyA_gGqyVs2W";

  let supabaseInitPromise = null;
  const ensureSupabase = async () => {
    const existing = window.kyloSupabase;
    if (existing && existing.auth) return existing;
    if (supabaseInitPromise) return supabaseInitPromise;

    supabaseInitPromise = (async () => {
      const supabaseUrl = String(window.kyloSupabaseUrl || FALLBACK_SUPABASE_URL);
      const supabaseAnonKey = String(window.kyloSupabaseAnonKey || FALLBACK_SUPABASE_ANON_KEY);
      if (!supabaseUrl || !supabaseAnonKey) return null;
      try {
        const mod = await import("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.49.1/+esm");
        const createClient = mod?.createClient;
        if (typeof createClient !== "function") return null;
        const sb = createClient(supabaseUrl, supabaseAnonKey, {
          auth: { persistSession: true, storage: window.localStorage },
        });
        window.kyloSupabase = sb;
        window.kyloSupabaseUrl = supabaseUrl;
        window.kyloSupabaseAnonKey = supabaseAnonKey;
        return sb;
      } catch (_) {
        return null;
      }
    })();

    return supabaseInitPromise;
  };

  const isSignedIn = async () => {
    const sb = await ensureSupabase();
    if (!sb) return false;
    try {
      const { data } = await sb.auth.getUser();
      return Boolean(data?.user);
    } catch (_) {
      return false;
    }
  };

  const ensureCheckoutAuthModal = () => {};
  const openCheckoutAuthModal = async () => true;
  const closeCheckoutAuthModal = (_value) => {};
  const wireCheckoutAuthForm = () => {};

  const ensureCheckoutAuth = async () => {
    return true;
  };

  const buildCartMarkup = () => {
    return `
      <a href="#" id="elCart" title="Your Cart" style="background-color: #1E212B;">
        <i class="fa fa-shopping-cart"></i> <span data-role="cartCount">0</span>
      </a>
      <div id="elCart_menu" class="ipsMenu ipsMenu_wide ipsHide">
        <div class="ipsMenu_headerBar"><h4 class="ipsType_sectionHead">Your Cart</h4></div>
        <div class="ipsMenu_innerContent ipsPad_half">
          <ul class="ipsDataList" data-role="cartList" id="elCartContent"></ul>
        </div>
        <div class="ipsMenu_footerBar ipsType_center">
          <a href="#" class="ipsButton ipsButton_small ipsButton_primary" data-action="cartCheckout">Review &amp; Checkout</a>
        </div>
      </div>
    `;
  };

  const ensureCartDom = () => {
    const allContainers = Array.from(document.querySelectorAll("#elCart_container"));
    let container = allContainers[0];
    if (!container) {
      const userNav = document.querySelector("ul#elUserNav");
      if (!userNav) return;

      const newContainer = document.createElement("li");
      newContainer.id = "elCart_container";
      newContainer.className = "cUserNav_icon";

      const newSep = document.createElement("li");
      newSep.id = "elCart_sep";
      newSep.className = "elUserNav_sep";
      newSep.style.marginLeft = "1.25em";

      const signIn = userNav.querySelector("#elSignInLink");
      if (signIn) {
        userNav.insertBefore(newSep, signIn);
        userNav.insertBefore(newContainer, newSep);
      } else {
        userNav.appendChild(newContainer);
        userNav.appendChild(newSep);
      }

      container = newContainer;
    }
    for (let i = 1; i < allContainers.length; i++) {
      allContainers[i].remove();
    }
    container.classList.remove("ipsHide");
    if (!container.querySelector("#elCart")) {
      container.innerHTML = buildCartMarkup();
    }
    const cartLink = container.querySelector("#elCart");
    if (cartLink) {
      cartLink.removeAttribute("data-ipsMenu");
      cartLink.removeAttribute("data-ipsMenu-closeOnClick");
      cartLink.removeAttribute("data-ipsTooltip");
    }

    const allSeps = Array.from(document.querySelectorAll("#elCart_sep"));
    const sep = allSeps[0];
    for (let i = 1; i < allSeps.length; i++) {
      allSeps[i].remove();
    }
    if (sep) sep.classList.remove("ipsHide");
  };

  const renderCart = () => {
    ensureCartDom();
    const cart = loadCart();
    const { count, subtotalCents } = getTotals(cart);

    const countEl = document.querySelector('#elCart [data-role="cartCount"]');
    if (countEl) countEl.textContent = String(count);

    const list = document.getElementById("elCartContent");
    if (!list) return;

    if (cart.items.length === 0) {
      list.innerHTML = `
        <li class="ipsDataItem cNexusMiniCart_row">
          <div class="ipsDataItem_main ipsType_center">
            <span class="ipsType_medium ipsType_reset ipsType_unbold">Your cart is empty</span>
          </div>
        </li>
      `;
      return;
    }

    const rows = cart.items
      .map((i) => {
        const title = `${i.productName}${i.variantName ? ` — ${i.variantName}` : ""}`;
        const img = i.imageUrl
          ? `<img class="ipsThumb_tiny" src="${i.imageUrl}" alt="">`
          : `<div class="ipsThumb_tiny ipsNoThumb ipsNoThumb_product">&nbsp;</div>`;
        return `
          <li class="ipsDataItem cNexusMiniCart_row">
            <div class="ipsDataItem_icon">${img}</div>
            <div class="ipsDataItem_main">
              <span class="ipsType_medium ipsType_reset ipsType_unbold">${title}</span>
            </div>
            <div class="ipsDataItem_generic ipsDataItem_size1 ipsType_center">&times;${i.quantity}</div>
            <div class="ipsDataItem_generic ipsDataItem_size3 cNexusPrice ipsType_normal ipsType_right">
              <strong>${formatCents(i.priceCents, cart.currency)}</strong>
            </div>
            <div class="ipsDataItem_generic ipsDataItem_size1 ipsType_center">
              <button type="button" data-action="cartRemove" data-variant-id="${i.variantId}" aria-label="Remove">&times;</button>
            </div>
          </li>
        `;
      })
      .join("");

    const totalRow = `
      <li class="ipsDataItem cNexusMenuCart_totalRow">
        <div class="ipsDataItem_main ipsType_large ipsType_right"><strong>Subtotal</strong></div>
        <div class="ipsDataItem_generic ipsDataItem_size3 cNexusPrice ipsType_large ipsType_right">
          <strong>${formatCents(subtotalCents, cart.currency)}</strong>
        </div>
      </li>
    `;

    list.innerHTML = rows + totalRow;
  };

  const toggleCartMenu = (forceOpen) => {
    const menu = document.getElementById("elCart_menu");
    if (!menu) return;
    const shouldOpen = typeof forceOpen === "boolean" ? forceOpen : menu.classList.contains("ipsHide");
    if (shouldOpen) {
      menu.classList.remove("ipsHide");
      return;
    }
    menu.classList.add("ipsHide");
  };

  const wireCartEvents = () => {
    document.addEventListener("click", (e) => {
      const remove = e.target instanceof Element ? e.target.closest('[data-action="cartRemove"]') : null;
      if (remove) {
        e.preventDefault();
        e.stopPropagation();
        const variantId = remove.getAttribute("data-variant-id") || "";
        if (variantId) {
          const cart = loadCart();
          cart.items = cart.items.filter((i) => i.variantId !== variantId);
          saveCart(cart);
          renderCart();
        }
        return;
      }

      const cartLink = e.target instanceof Element ? e.target.closest("#elCart") : null;
      if (cartLink) {
        e.preventDefault();
        e.stopImmediatePropagation();
        toggleCartMenu();
        return;
      }

      const checkout = e.target instanceof Element ? e.target.closest('[data-action="cartCheckout"]') : null;
      if (checkout) {
        e.preventDefault();
        void beginCheckout();
        return;
      }

      const menu = document.getElementById("elCart_menu");
      if (!menu) return;

      const clickedInside = e.target instanceof Element ? e.target.closest("#elCart_menu") : null;
      if (!clickedInside) toggleCartMenu(false);
    });

    document.addEventListener("keydown", (e) => {
      if (e.key !== "Escape") return;
      toggleCartMenu(false);
    });
  };

  const addToCart = ({ variantId, productName, productSlug, variantName, price, imageUrl, quantity = 1 }) => {
    const cart = loadCart();
    upsertItem(cart, {
      variantId,
      productName,
      productSlug,
      variantName,
      priceCents: parsePriceToCents(price),
      quantity,
      imageUrl,
    });
    saveCart(cart);
    renderCart();
    openAddedModal({ productName, variantName, quantity });
  };

  const clearCart = () => {
    saveCart({ currency: DEFAULT_CURRENCY, items: [] });
    renderCart();
  };

  window.kyloAddToCart = addToCart;
  window.kyloClearCart = clearCart;
  window.kyloRenderCart = renderCart;

  document.addEventListener("DOMContentLoaded", () => {
    ensureStyles();
    ensureCartDom();
    wireCartEvents();
    renderCart();
  });
})();
