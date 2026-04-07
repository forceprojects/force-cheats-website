import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.49.1/+esm";

const supabaseUrl = window.kyloSupabaseUrl || "";
const supabaseAnonKey = window.kyloSupabaseAnonKey || "";

const getSupabase = () => {
  if (window.kyloSupabase) return window.kyloSupabase;
  if (!supabaseUrl || !supabaseAnonKey) return null;
  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: true, storage: window.localStorage },
  });
};

const els = {
  loading: document.getElementById("purchasesLoading"),
  empty: document.getElementById("purchasesEmpty"),
  emptyTitle: document.getElementById("purchasesEmptyTitle"),
  emptyDesc: document.getElementById("purchasesEmptyDesc"),
  list: document.getElementById("purchasesList"),
};

const ensurePurchasesStyles = () => {
  if (document.getElementById("kyloPurchasesStyles")) return;
  const style = document.createElement("style");
  style.id = "kyloPurchasesStyles";
  style.textContent = `
    @font-face{
      font-family: Geist;
      src: url("code-theme/fonts/Geist-Regular.ttf") format("truetype");
      font-weight: 400;
      font-style: normal;
      font-display: swap;
    }

    :root{
      --accent-color:#1d68d7;
      --dark-accent-color:#0B53D1;
      --accent-rgb:29,104,215;
      --light-accent-color:rgba(29,104,215,.15);
      --muted:rgba(255,255,255,.72);
      --muted-70:rgba(255,255,255,.70);
      --muted-80:rgba(255,255,255,.80);
      --border:rgba(255,255,255,.10);
    }

    .w-full{width:100%}
    .flex{display:flex}
    .flex-row{flex-direction:row}
    .flex-col{flex-direction:column}
    .items-center{align-items:center}
    .items-start{align-items:flex-start}
    .items-end{align-items:flex-end}
    .justify-between{justify-content:space-between}
    .justify-center{justify-content:center}
    .text-center{text-align:center}
    .gap-1{gap:4px}
    .gap-2{gap:8px}
    .gap-3{gap:12px}
    .gap-4{gap:16px}
    .rounded-md{border-radius:8px}
    .rounded-lg{border-radius:12px}
    .p-2{padding:8px}
    .p-4{padding:16px}
    .px-2{padding-left:8px;padding-right:8px}
    .px-1{padding-left:4px;padding-right:4px}
    .px-3{padding-left:12px;padding-right:12px}
    .px-4{padding-left:16px;padding-right:16px}
    .py-1{padding-top:4px;padding-bottom:4px}
    .py-2{padding-top:8px;padding-bottom:8px}
    .my-4{margin-top:16px;margin-bottom:16px}
    .mt-4{margin-top:16px}
    .mt-2{margin-top:8px}
    .min-h-\\[28px\\]{min-height:28px}
    .min-h-\\[60px\\]{min-height:60px}
    .h-\\[1px\\]{height:1px}
    .w-\\[1px\\]{width:1px}
    .border-b{border-bottom:1px solid var(--border)}
    .border{border:1px solid var(--border)}
    .border-transparent{border-color:transparent}
    .bg-accent{background:rgba(var(--accent-rgb),.35)}
    .bg-accent\\/30{background:#171921}
    .bg-background{background:#1C1E28}
    .text-lg{font-size:18px;line-height:1.2}
    .text-sm{font-size:14px;line-height:1.2}
    .text-xs{font-size:12px;line-height:1.2}
    .text-\\[10px\\]{font-size:10px;line-height:1.2}
    .font-semibold{font-weight:700}
    .font-medium{font-weight:600}
    .capitalize{text-transform:capitalize}
    .uppercase{text-transform:uppercase}
    .text-muted-foreground{color:var(--muted)}
    .text-muted-foreground\\/70{color:var(--muted-70)}
    .text-muted-foreground\\/80{color:var(--muted-80)}
    .text-\\[--accent-color\\]{color:var(--accent-color)}
    .bg-\\[--light-accent-color\\]{background:var(--light-accent-color)}
    .text-green-500{color:#22c55e}
    .bg-green-500\\/15{background:rgba(34,197,94,.15)}
    .bg-green-500\\/20{background:rgba(34,197,94,.20)}
    .text-red-500{color:#ef4444}
    .bg-red-500\\/15{background:rgba(239,68,68,.15)}
    .text-white{color:#fff}
    .text-white\\/90{color:rgba(255,255,255,.9)}
    .bg-white\\/15{background:rgba(255,255,255,.12)}
    .hover\\:bg-white\\/25:hover{background:rgba(255,255,255,.18)}
    .duration-200{transition-duration:200ms}
    .duration-300{transition-duration:300ms}
    .cursor-pointer{cursor:pointer}
    .min-w-max{min-width:max-content}
    .overflow-x-scroll{overflow-x:auto}
    .whitespace-pre-wrap{white-space:pre-wrap}
    .\\[\\&\\>div\\]\\:w-full>div{width:100%}
    .kyloOrdersFont{font-family: Geist, system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif}

    .select-none{user-select:none}
    .inline-flex{display:inline-flex}
    .whitespace-nowrap{white-space:nowrap}
    .h-8{height:32px}
    .w-fit{width:fit-content}
    .h-24{height:96px}
    .resize-none{resize:none}
    .outline-none{outline:none}
    .shadow-sm{box-shadow:0 1px 2px rgba(0,0,0,.18)}
    .transition-colors{transition-property:background-color,border-color,color,fill,stroke}
    .animate-fade-in{animation: kyloFadeIn .2s ease both}
    @keyframes kyloFadeIn{from{opacity:0;transform:translateY(2px)}to{opacity:1;transform:translateY(0)}}
    .hover\\:bg-\\[\\#262626\\]:hover{background:#262626}

    .bg-accent\\/30{border:0}
    .bg-background{border:0}
    .bg-\\[--accent-color\\]{background:var(--accent-color)}
    .hover\\:bg-\\[--dark-accent-color\\]:hover{background:var(--dark-accent-color)}
    .kyloDeliveredGoodsCard{background:#1C1E28;border:0}
    .kyloRatingCard{background:#171921;border:0}
    .kyloOrderSeparator{background:#1C1E28}

    .placeholder\\:text-muted-foreground\\/70::placeholder{color:var(--muted-70)}
    .placeholder\\:text-xs::placeholder{font-size:12px}
    .placeholder\\:leading-none::placeholder{line-height:1}
    .border-input{border-color:rgba(255,255,255,.12)}
    .focus-visible\\:outline-none:focus-visible{outline:none}
    .focus-visible\\:ring-4:focus-visible{box-shadow:0 0 0 4px rgba(var(--accent-rgb),.15)}
    .focus-visible\\:ring-primary\\/15:focus-visible{box-shadow:0 0 0 4px rgba(var(--accent-rgb),.15)}
    .focus-visible\\:border-primary:focus-visible{border-color:rgba(var(--accent-rgb),.55)}
    .bg-transparent{background:transparent}
    .disabled\\:opacity-50:disabled{opacity:.5}
    .disabled\\:cursor-not-allowed:disabled{cursor:not-allowed}
    .disabled\\:pointer-events-none:disabled{pointer-events:none}

    .h-14{height:56px}
    .w-14{width:56px}
    .min-w-14{min-width:56px}
    .min-h-14{min-height:56px}
    .rounded{border-radius:6px}
    .object-cover{object-fit:cover}
    .shrink-0{flex-shrink:0}
    .line-clamp-1{display:-webkit-box;-webkit-line-clamp:1;-webkit-box-orient:vertical;overflow:hidden}
    .text-white\\/20{color:rgba(255,255,255,.2)}
    .hover\\:scale-110:hover{transform:scale(1.1)}
    .space-x-2 > :not([hidden]) ~ :not([hidden]){margin-left:8px}
    .kyloStarActive{color:var(--accent-color)}
    .kyloStarInactive{color:rgba(255,255,255,.2)}
    .kyloStars{list-style:none;margin:0;padding:0}
    .kyloStars > li{list-style:none;margin:0;padding:0}
    .kyloStars > li::marker{content:""}

    .md\\:sticky{position:static}
    .md\\:top-20{top:80px}
    .h-fit{height:fit-content}
    .min-h-\\[calc\\(100svh-380px-70px-50px\\)\\]{min-height:calc(100svh - 380px - 70px - 50px)}

    @media (min-width: 768px){
      .md\\:w-2\\/3{width:66.666667%}
      .md\\:w-1\\/3{width:33.333333%}
      .md\\:flex-row{flex-direction:row}
      .md\\:sticky{position:sticky}
    }
    @media (min-width: 640px){
      .sm\\:text-xl{font-size:20px}
      .sm\\:flex-row{flex-direction:row}
      .sm\\:items-center{align-items:center}
    }
  `.trim();
  document.head.appendChild(style);
};

const showLoading = () => {
  els.loading?.classList.remove("ipsHide");
  els.empty?.classList.add("ipsHide");
  els.list?.classList.add("ipsHide");
};

const showEmpty = (title, desc) => {
  if (els.emptyTitle) els.emptyTitle.textContent = title;
  if (els.emptyDesc) els.emptyDesc.textContent = desc;
  els.loading?.classList.add("ipsHide");
  els.list?.classList.add("ipsHide");
  els.empty?.classList.remove("ipsHide");
};

const showNoPurchasesEmpty = (user) => {
  const email = String(user?.email || "unknown").trim();
  const id = String(user?.id || "").trim();
  const line = id ? `Signed in as: ${email} (${id})` : `Signed in as: ${email}`;
  if (els.empty) {
    els.empty.innerHTML =
      '<div class="ipsBox ipsPad">' +
      '<h2 class="ipsType_pageTitle ipsType_center ipsType_reset ipsType_light ipsPadding:half">You don&#039;t have any purchases yet.</h2>' +
      '<div class="ipsPadding:half ipsType_center ipsType_small">' +
      line.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;") +
      "</div>" +
      '<hr class="ipsHr">' +
      '<ul class="ipsFlex ipsFlex-ai:center ipsFlex-jc:center ipsFlex-fw:wrap ipsGap:2">' +
      '<li><a href="index.html" class="ipsButton ipsButton_primary ipsButton_medium">Change it Now!</a></li>' +
      "</ul>" +
      "</div>";
  }
  els.loading?.classList.add("ipsHide");
  els.list?.classList.add("ipsHide");
  els.empty?.classList.remove("ipsHide");
};

const showList = (html) => {
  if (els.list) els.list.innerHTML = html;
  els.loading?.classList.add("ipsHide");
  els.empty?.classList.add("ipsHide");
  els.list?.classList.remove("ipsHide");
};

const formatDateTime = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const formatMoney = (value, currency = "USD") => {
  const n = typeof value === "number" ? value : Number(String(value ?? "").replace(",", "."));
  const amount = Number.isFinite(n) ? n : 0;
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
};

const escapeHtml = (value) =>
  String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

const normalizeUsername = (value) => {
  const s = String(value || "").trim().toLowerCase();
  if (!s) return "";
  const cleaned = s.replace(/[^a-z0-9._-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
  return cleaned.slice(0, 32);
};

const productKeyFromTitle = (title) => {
  const t = String(title || "").toLowerCase();
  if (t.includes("rust")) return "rust";
  if (t.includes("arc")) return "arc-raiders";
  if (t.includes("r6") || t.includes("siege")) return "r6s";
  if (t.includes("hwid") || t.includes("spoofer") || t.includes("optimizer")) return "hwid-spoofer";
  return normalizeUsername(t) || "product";
};

const productDisplayNameFromKey = (key) => {
  const k = String(key || "").trim().toLowerCase();
  if (k === "rust") return "Rust";
  if (k === "arc-raiders") return "Arc Raiders";
  if (k === "r6s") return "Rainbow Six Siege";
  if (k === "hwid-spoofer") return "HWID Spoofer";
  return key;
};

const renderStars = (attrs = "") =>
  `<ul class="flex flex-row gap-2 kyloStars" ${attrs}>
    ${[1, 2, 3, 4, 5]
      .map(
        (n) => `
      <li data-value="${n}" class="star cursor-pointer hover:scale-110 duration-300 kyloStarInactive">
        <svg width="24" height="20" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path fill="currentColor" d="m11.443 19.478-4.328 2.378c-.584.321-1.307.086-1.615-.524a1.3 1.3 0 0 1-.12-.793l.827-5.037a1.29 1.29 0 0 0-.344-1.106L2.36 10.83a1.29 1.29 0 0 1-.021-1.767c.183-.197.424-.325.684-.364l4.839-.735c.39-.06.726-.315.9-.684l2.165-4.582c.292-.619 1.009-.873 1.601-.568.236.122.427.321.543.568l2.164 4.582c.175.369.511.625.901.684l4.839.735c.654.099 1.106.733 1.011 1.416a1.27 1.27 0 0 1-.348.715l-3.502 3.567c-.282.287-.41 .7-.344 1.106l.827 5.037c.112 .68-.326 1.326-.977 1.443a1.15 1.15 0 0 1-.758-.126l-4.328-2.378a1.15 1.15 0 0 0-1.114 0"></path>
        </svg>
      </li>
    `,
      )
      .join("")}
  </ul>`;

const renderPurchases = (rows, { userReviewsByOrderId, storeConfig } = {}) => {
  const purchases = Array.isArray(rows) ? rows : [];
  const reviewsMap = userReviewsByOrderId instanceof Map ? userReviewsByOrderId : new Map();
  const storeCfg = storeConfig && typeof storeConfig === "object" ? storeConfig : null;

  const statusText = (p) => {
    const raw = String(p?.financial_status || "paid").toLowerCase();
    if (raw === "paid") return "completed";
    return raw;
  };

  const statusClass = (p) => {
    const raw = String(p?.financial_status || "paid").toLowerCase();
    if (raw === "paid" || raw === "completed") return "text-green-500 bg-green-500/15";
    if (raw === "failed" || raw === "cancelled") return "text-red-500 bg-red-500/15";
    return "text-muted-foreground bg-white/15";
  };

  const storeName = "Force Cheats®";
  const getVariantLabelForLineItem = (purchase, lineItem) => {
    const li = lineItem || null;
    const variantId = li?.variant_id ?? li?.variantId ?? null;
    const rawItems = Array.isArray(purchase?.raw?.line_items) ? purchase.raw.line_items : [];
    const match = rawItems.find((x) => String(x?.variant_id || "") === String(variantId || ""));
    const label =
      match?.variant_title ||
      match?.variantTitle ||
      match?.name ||
      li?.variant_title ||
      li?.variantTitle ||
      li?.variant ||
      "";
    return String(label || "").trim();
  };

  const getLineItems = (purchase) => {
    const items = Array.isArray(purchase?.line_items) ? purchase.line_items : [];
    return items.filter(Boolean);
  };

  const getLineItemUnitPrice = (purchase, lineItem) => {
    const li = lineItem || {};
    const price =
      li?.price ??
      li?.price_amount ??
      li?.priceAmount ??
      li?.price_set?.shop_money?.amount ??
      li?.priceSet?.shopMoney?.amount ??
      null;
    const n = typeof price === "number" ? price : Number(String(price ?? "").replace(",", "."));
    if (Number.isFinite(n)) return n;
    const fallback = purchase?.total_price;
    const f = typeof fallback === "number" ? fallback : Number(String(fallback ?? "").replace(",", "."));
    return Number.isFinite(f) ? f : 0;
  };

  const formatVariantDisplay = (variantLabel) => {
    const v = String(variantLabel || "").trim();
    if (!v) return "";
    if (v.toLowerCase().includes("license")) return v;
    return `${v} License`;
  };

  const normalizeImageUrl = (rawUrl) => {
    const u = String(rawUrl || "").trim();
    if (!u) return "";
    if (/^(https?:)?\/\//i.test(u)) return u;
    if (u.startsWith("data:")) return u;
    if (u.startsWith("/")) return u;
    return "/" + u.replace(/^\.?\//, "");
  };

  const productImageBySlug = (() => {
    const map = new Map();
    const products = Array.isArray(storeCfg?.products) ? storeCfg.products : [];
    products.forEach((p) => {
      const slug = String(p?.slug || "").trim().toLowerCase();
      const img = normalizeImageUrl(p?.primaryImage || p?.primary_image || "");
      if (slug && img) map.set(slug, img);
    });
    return map;
  })();

  const getProductSlugForLineItem = (purchase, lineItem) => {
    const li = lineItem || null;
    const direct = String(li?.productSlug || li?.product_slug || "").trim();
    if (direct) return direct;

    const cart = purchase?.raw && typeof purchase.raw === "object" ? purchase.raw.cart : null;
    const cartItems = Array.isArray(cart?.items) ? cart.items : [];
    if (!cartItems.length) return "";

    if (cartItems.length === 1) return String(cartItems[0]?.productSlug || "").trim();

    const title = String(li?.title || li?.name || "").trim().toLowerCase();
    if (!title) return "";
    const match = cartItems.find((ci) => String(ci?.productName || "").trim().toLowerCase() === title);
    return match ? String(match?.productSlug || "").trim() : "";
  };

  const getProductImageSrc = (purchase, lineItem, titleFallback) => {
    const slug = String(getProductSlugForLineItem(purchase, lineItem) || "").trim().toLowerCase();
    if (slug && productImageBySlug.has(slug)) return productImageBySlug.get(slug);

    const t = String(titleFallback || "").toLowerCase();
    if (t.includes("rust")) return "/products/images/product-main/rust.png";
    if (t.includes("spoofer")) return "/products/images/product-main/spoofer.png";
    if (t.includes("r6") || t.includes("siege")) return "/products/images/product-main/r6s.png";
    if (t.includes("arc")) return "/products/images/product-main/arc.png";
    if (t.includes("hwid") || t.includes("optimizer")) return "/products/images/product-main/spoofer.png";
    return "/images/no_image_placeholder.svg";
  };

  const renderOrderedItemsCard = (p) => {
    const items = getLineItems(p);
    const currency = "USD";

    const blocks = (items.length ? items : [null])
      .map((li) => {
        const itemName = String(li?.title || li?.name || "Product");
        const itemVariant = formatVariantDisplay(getVariantLabelForLineItem(p, li));
        const itemQty = Number(li?.quantity) || 1;
        const unitPrice = getLineItemUnitPrice(p, li);
        const itemPrice = formatMoney(unitPrice, currency);
        const itemImage = getProductImageSrc(p, li, itemName);

        return `
          <div class="bg-accent/30 p-4 rounded-lg flex flex-col gap-2">
            <div class="w-full flex flex-col sm:flex-row sm:items-center gap-3">
              <div style="opacity: 1;"><img alt="product image" loading="lazy" width="256" height="256" decoding="async" data-nimg="1" class="h-14 w-14 min-w-14 min-h-14 rounded-md object-cover shrink-0" srcset="${escapeHtml(itemImage)} 1x, ${escapeHtml(itemImage)} 2x" src="${escapeHtml(itemImage)}" style="color: transparent;"></div>
              <div class="w-full flex flex-col sm:flex-row justify-between gap-2">
                <div class="flex flex-col justify-between gap-1 w-full">
                  <div class="flex flex-col">
                    <div class="text-sm line-clamp-1">${escapeHtml(itemName)}</div>
                    <div class="text-xs text-muted-foreground/70 line-clamp-1">${escapeHtml(itemVariant)}</div>
                  </div>
                  <div class="flex flex-row items-center justify-between gap-2">
                    <div class="text-sm font-medium text-[--accent-color]">${escapeHtml(itemPrice)} <span class="text-[10px] text-muted-foreground/70">x${itemQty} </span></div>
                    <div class="w-fit bg-green-500/20 text-green-500 rounded px-1 py-1 gap-1 text-[10px] flex items-center font-medium">
                      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-shield">
                        <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"></path>
                      </svg>
                      Includes Warranty
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        `;
      })
      .join("\n");

    return `
      <div class="w-full flex flex-col gap-4">
        <div class="gap-4 flex flex-col">
          ${blocks}
        </div>
      </div>
      <p class="text-xs text-center px-4" style="color:#757575">Thanks for purchasing from us, you are our valued customer. Please come back again. Thanks.</p>
    `;
  };

  const renderRatingCard = (p) => {
    const orderUuid = String(p?.id || "").trim();
    const orderLabel = String(p?.order_name || "").trim() || orderUuid;
    const already = orderUuid ? reviewsMap.get(orderUuid) || null : null;

    if (already) {
      return `
        <div class="w-full flex flex-col gap-4 h-fit">
          <div class="kyloRatingCard p-4 rounded-lg flex flex-col gap-2" data-review-order="${escapeHtml(orderUuid)}" data-has-review="1">
            <div class="flex flex-row items-center justify-between gap-2">
              <span class="text-xs font-semibold">Feedback for order ${escapeHtml(orderLabel)}</span>
              <span class="text-xs uppercase px-2 py-1 rounded-md bg-green-500/15 text-green-500">Submitted</span>
            </div>
            <div class="flex flex-row gap-2 bg-background p-4 rounded-lg" style="pointer-events:none;opacity:.95">
              ${renderStars(`data-review-stars data-review-order="${escapeHtml(orderUuid)}"`)}
            </div>
            <div class="text-xs text-muted-foreground/80 whitespace-pre-wrap">${escapeHtml(String(already.content || ""))}</div>
          </div>
        </div>
      `;
    }

    return `
      <div class="w-full flex flex-col gap-4 h-fit">
        <div class="kyloRatingCard p-4 rounded-lg flex flex-col gap-2" data-review-order="${escapeHtml(orderUuid)}">
          <span class="text-xs font-semibold">Leave feedback for order ${escapeHtml(orderLabel)}</span>
          <div class="flex flex-row gap-2 bg-background p-4 rounded-lg">
            ${renderStars(`data-review-stars data-review-order="${escapeHtml(orderUuid)}"`)}
          </div>
          <textarea class="border-input focus-visible:ring-primary/15 focus-visible:border-primary flex min-h-[60px] border text-sm shadow-sm duration-200 focus-visible:ring-4 disabled:cursor-not-allowed disabled:opacity-50 w-full h-24 p-4 rounded-lg resize-none outline-none placeholder:text-muted-foreground placeholder:text-sm bg-background" data-review-text placeholder="Write your feedback here"></textarea>
          <button type="button" class="animate-fade-in select-none inline-flex items-center justify-center border border-transparent whitespace-nowrap rounded-md text-sm transition-colors focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50 duration-200 text-white h-8 px-3 py-2 w-full bg-[--accent-color] hover:bg-[--dark-accent-color] mt-2 space-x-2" data-review-submit data-review-order="${escapeHtml(orderUuid)}">
            <svg width="16" height="16" viewBox="0 0 24 24" data-name="Flat Line" xmlns="http://www.w3.org/2000/svg">
              <path d="M5 12h14m-7-7v14" style="fill: currentcolor; stroke: currentcolor; stroke-linecap: round; stroke-linejoin: round; stroke-width: 2;"></path>
            </svg>
            <span>Leave Feedback</span>
          </button>
          <div class="text-xs text-muted-foreground/80" data-review-status></div>
        </div>
      </div>
    `;
  };



  const renderOrderBlock = (p) => {
    const orderUuid = String(p?.id || "").trim();
    const createdAt = formatDateTime(p?.processed_at || p?.created_at);
    const provider = String(p?.payment_provider || p?.raw?.payment_provider || "shopify")
      .trim()
      .toLowerCase();
    const paymentMethod = provider === "moneymotion" ? "MoneyMotion" : "Shopify";
    const currency = String(p?.currency || "USD").trim().toUpperCase() || "USD";
    const amount = formatMoney(p?.total_price, currency);
    const purchaserEmail = String(p?.purchaser_email || "").trim();
    const items = getLineItems(p);
    const first = items[0] || null;
    const variantLabel = formatVariantDisplay(getVariantLabelForLineItem(p, first));
    const licenseKeys = Array.isArray(p?.license_keys) ? p.license_keys : [];
    const licenseText = licenseKeys
      .map((k) => String(k?.key || k?.value || k || "").trim())
      .filter(Boolean)
      .join("\n");

    const hasAnyFeedback = orderUuid ? reviewsMap.has(orderUuid) : false;

    const deliveredBlocks = (items.length ? items : [null])
      .map((li) => {
        const title = String(li?.title || li?.name || "Product");
        const v = formatVariantDisplay(getVariantLabelForLineItem(p, li));
        return `
          <div class="bg-background rounded-lg flex flex-col">
            <div class="p-4 border-b flex flex-col sm:flex-row sm:items-center justify-between">
              <div class="text-sm flex flex-col">
                <span class="text-white/90">${escapeHtml(title)}</span><span class="text-xs text-muted-foreground/80">${escapeHtml(v || "")}</span>
              </div>

              <div class="flex flex-row items-center gap-2">
                <div aria-hidden="true" class="uppercase px-2 py-1 rounded-md text-white/90 bg-white/15 hover:bg-white/25 duration-200 text-xs cursor-pointer min-w-max">Save File</div>
                <div aria-hidden="true" class="uppercase px-2 py-1 rounded-md text-white/90 bg-white/15 hover:bg-white/25 duration-200 text-xs cursor-pointer min-w-max">Copy All</div>
              </div>
            </div>
            <div class="p-4 flex flex-col gap-1">
              <div class="flex flex-col gap-1 p-2 rounded-md bg-accent/30">
                <div class="text-[10px] text-muted-foreground/70">Variant Note:</div>
                <div class="flex whitespace-pre-wrap overflow-x-scroll [&>div]:w-full"><div>${escapeHtml(licenseText)}</div></div>
              </div>

              <div class="flex flex-col mt-4 gap-1">
                <div class="text-xs">Thank You for your purchase! Join to our Discord Community Server -> https://discord.gg/forcecheats</div>
              </div>
            </div>
          </div>
        `;
      })
      .join("\n");

    return `
      <div class="bg-accent/30 p-4 rounded-lg" data-order-id="${escapeHtml(orderUuid)}">
        <div class="flex flex-row items-start justify-between">
          <div class="flex flex-col gap-2 items-start">
            <span class="text-xs text-muted-foreground/70 font-semibold">Order ID</span>
            <span class="font-semibold text-sm sm:text-xl text-[--accent-color]">${escapeHtml(String(p?.order_name || "") || orderUuid)}</span>
          </div>
          <div class="flex flex-col gap-2 items-end">
            <span class="font-medium text-sm px-2 py-1 rounded-md ${statusClass(p)} capitalize">${escapeHtml(statusText(p))}</span>
          </div>
        </div>

        <div class="w-full h-[1px] kyloOrderSeparator my-4"></div>

        <div class="flex flex-col gap-2">
          <div class="min-h-[28px] flex flex-row gap-4 justify-between items-center">
            <span class="text-xs text-muted-foreground/70">Store</span>
            <span class="text-sm text-muted-foreground">${escapeHtml(storeName)}</span>
          </div>
          <div class="min-h-[28px] flex flex-row gap-4 justify-between items-center">
            <span class="text-xs text-muted-foreground/70">Your Email</span>
            <span class="text-sm">${escapeHtml(purchaserEmail || "—")}</span>
          </div>
          <div class="min-h-[28px] flex flex-row gap-4 justify-between items-center">
            <span class="text-xs text-muted-foreground/70">Payment Method</span>
            <span class="font-medium text-xs text-[--accent-color] px-2 py-1 rounded-md bg-[--light-accent-color] capitalize">${escapeHtml(paymentMethod)}</span>
          </div>
          <div class="min-h-[28px] flex flex-row gap-4 justify-between items-center">
            <span class="text-xs text-muted-foreground/70">Order Amount</span>
            <span class="text-sm text-muted-foreground">${escapeHtml(amount)}</span>
          </div>
          <div class="min-h-[28px] flex flex-row gap-4 justify-between items-center">
            <span class="text-xs text-muted-foreground/70">Order Created At</span>
            <span class="text-sm uppercase">${escapeHtml(createdAt || "—")}</span>
          </div>
          <div class="min-h-[28px] flex flex-row gap-4 justify-between items-center">
            <span class="text-xs text-muted-foreground/70">Feedback Given</span>
            <span class="text-sm">
              ${
                hasAnyFeedback
                  ? '<span class="text-xs uppercase px-2 py-1 rounded-md bg-green-500/15 text-green-500">Yes</span>'
                  : '<span class="text-xs uppercase px-2 py-1 rounded-md bg-red-500/15 text-red-500">No</span>'
              }
            </span>
          </div>

          <div class="mt-4 font-semibold text-sm text-white">Delivered Goods</div>
          ${deliveredBlocks}
        </div>
      </div>
    `;
  };

  return `
    <div class="kyloOrdersFont mt-2 flex flex-col md:flex-row gap-4 min-h-[calc(100svh-380px-70px-50px)] w-full">
      <div class="w-full flex flex-col gap-4">
        ${purchases
          .map(
            (p) => `
              <div class="flex flex-col md:flex-row gap-4 w-full">
                <div class="w-full md:w-2/3 flex flex-col gap-4">${renderOrderBlock(p)}</div>
                <div class="w-full md:w-1/3 flex flex-col gap-4 h-fit">${renderRatingCard(p)}${renderOrderedItemsCard(p)}</div>
              </div>
            `,
          )
          .join("")}
      </div>
    </div>
  `;
};

const isMissingTableError = (error) => {
  const code = String(error?.code || "");
  const message = String(error?.message || "");
  return code === "PGRST205" || (message.includes("Could not find the table") && message.includes("purchases"));
};

const isMissingColumnError = (error, columnName) => {
  if (!error) return false;
  const code = String(error?.code || "");
  const message = String(error?.message || "").toLowerCase();
  const col = String(columnName || "").toLowerCase();
  if (!col) return false;
  if (code === "42703") return message.includes(col);
  if (message.includes("could not find the") && message.includes(col)) return true;
  if (message.includes("column") && message.includes(col) && message.includes("does not exist")) return true;
  return false;
};

const hasPaidPurchase = (rows) => {
  const purchases = Array.isArray(rows) ? rows : [];
  return purchases.some((p) => {
    const s = String(p?.financial_status ?? "").trim().toLowerCase();
    return s === "paid" || s === "completed";
  });
};

const isConfirmedPurchase = (p) => {
  const s = String(p?.financial_status ?? "").trim().toLowerCase();
  return s === "paid" || s === "completed";
};

const loadStoreConfig = async (supabase) => {
  if (!supabase) return null;
  try {
    const { data, error } = await supabase.from("site_kv").select("value").eq("key", "store_config").maybeSingle();
    if (error) return null;
    const v = data?.value;
    return v && typeof v === "object" ? v : null;
  } catch (_) {
    return null;
  }
};

const ensureCustomerRole = async (supabase, user, { currentUsername, currentDisplayName, purchases } = {}) => {
  if (!supabase || !user) return false;
  if (!hasPaidPurchase(purchases)) return false;

  const email = String(user?.email || "").trim().toLowerCase();
  const metaUsername = String(user?.user_metadata?.username || user?.user_metadata?.user_name || "").trim().toLowerCase();
  if (email === "surgeworldorder@protonmail.com" || metaUsername === "admin") return false;

  try {
    const alreadyGranted = window.sessionStorage?.getItem?.("kylo_customer_granted") === "1";
    if (alreadyGranted) return true;
  } catch (_) {}

  try {
    await supabase.auth.updateUser({
      data: { role: "customer", user_role: "customer", account_role: "customer" },
    });
  } catch (_) {}

  try {
    const { data, error } = await supabase
      .from("profiles")
      .update({ role: "Customer" })
      .eq("id", user.id)
      .select("role")
      .maybeSingle();

    if (!error && data) {
      try {
        window.sessionStorage?.setItem?.("kylo_customer_granted", "1");
      } catch (_) {}
      return true;
    }

    if (error && isMissingColumnError(error, "role")) return false;
  } catch (_) {}

  try {
    const profilePayload = {
      id: user.id,
      username: normalizeUsername(currentUsername || "") || normalizeUsername(String(user.email || "").split("@")[0] || "") || "account",
      display_name: String(currentDisplayName || "").trim() || normalizeUsername(currentUsername || "") || "Customer",
      role: "Customer",
      joined_at: user.created_at || null,
      last_visited_at: new Date().toISOString(),
    };

    const { error } = await supabase.from("profiles").upsert(profilePayload, { onConflict: "id" });
    if (!error) {
      try {
        window.sessionStorage?.setItem?.("kylo_customer_granted", "1");
      } catch (_) {}
      return true;
    }
    if (isMissingColumnError(error, "role")) return false;
  } catch (_) {}

  return false;
};

const main = async () => {
  ensurePurchasesStyles();
  showLoading();
  const supabase = getSupabase();
  if (!supabase) {
    showEmpty("Purchases unavailable", "Supabase is not configured on this page.");
    return;
  }

  const { data: userData } = await supabase.auth.getUser();
  const user = userData?.user || null;
  if (!user) {
    showEmpty("Sign in required", "Please sign in to view your purchases.");
    return;
  }

  let currentUsername = normalizeUsername(user?.user_metadata?.username || user?.user_metadata?.user_name || "");
  let currentDisplayName = String(user?.user_metadata?.full_name || "").trim();
  try {
    const { data } = await supabase.from("profiles").select("username,display_name").eq("id", user.id).maybeSingle();
    if (data?.username) currentUsername = normalizeUsername(data.username);
    if (data?.display_name) currentDisplayName = String(data.display_name).trim();
  } catch (_) {}
  if (!currentUsername) currentUsername = normalizeUsername(String(user.email || "").split("@")[0] || "") || "account";
  if (!currentDisplayName) currentDisplayName = currentUsername;

  const { data, error } = await supabase
    .from("purchases")
    .select("id, user_id, purchaser_email, shopify_order_id, order_name, financial_status, currency, total_price, created_at, processed_at, line_items, license_keys, raw, payment_provider, provider_checkout_session_id")
    .or(`user_id.eq.${user.id},purchaser_email.eq.${String(user.email || "").toLowerCase()}`)
    .order("processed_at", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    if (isMissingTableError(error)) {
      showEmpty("Purchases not set up", "The purchases table is missing in Supabase.");
      return;
    }
    const detail = String(error?.message || error?.hint || "").trim();
    showEmpty("Failed to load purchases", detail || "Please try again later.");
    return;
  }

  const rows = Array.isArray(data) ? data : [];
  if (!rows.length) {
    showNoPurchasesEmpty(user);
    return;
  }

  await ensureCustomerRole(supabase, user, { currentUsername, currentDisplayName, purchases: rows });

  const reviewsByOrder = new Map();
  let reviewsTableAvailable = true;
  try {
    const { data: myReviews, error: reviewsErr } = await supabase
      .from("order_reviews")
      .select("id,order_id,rating,content,created_at")
      .eq("user_id", user.id)
      .limit(200);
    if (reviewsErr) {
      const code = String(reviewsErr?.code || "");
      const msg = String(reviewsErr?.message || "");
      if (code === "PGRST205" || (msg.includes("Could not find the table") && msg.includes("order_reviews"))) {
        reviewsTableAvailable = false;
      }
    } else if (Array.isArray(myReviews)) {
      myReviews.forEach((r) => {
        const k = String(r?.order_id || "").trim();
        if (k) reviewsByOrder.set(k, r);
      });
    }
  } catch (_) {
    reviewsTableAvailable = false;
  }

  const confirmed = rows.filter(isConfirmedPurchase);
  if (!confirmed.length) {
    showEmpty("No completed purchases yet", "Your purchases will appear here after payment is completed.");
    return;
  }

  const storeConfig = await loadStoreConfig(supabase);
  showList(renderPurchases(confirmed, { userReviewsByOrderId: reviewsByOrder, storeConfig }));

  const setStars = (ul, value) => {
    const v = Number(value) || 0;
    ul.querySelectorAll(".star").forEach((li) => {
      const n = Number(li.getAttribute("data-value")) || 0;
      li.classList.toggle("kyloStarActive", n <= v);
      li.classList.toggle("kyloStarInactive", n > v);
    });
  };

  const selectedRatings = new Map();

  document.querySelectorAll(".kyloRatingCard[data-review-order][data-has-review='1']").forEach((card) => {
    const key = String(card.getAttribute("data-review-order") || "").trim();
    const existing = reviewsByOrder.get(key);
    const ul = card.querySelector('ul[data-review-stars][data-review-order]');
    const rating = Number(existing?.rating) || 0;
    if (ul) setStars(ul, rating);
  });

  document.querySelectorAll('ul[data-review-stars][data-review-order]').forEach((ul) => {
    const key = String(ul.getAttribute("data-review-order") || "").trim();
    if (!key) return;
    if (reviewsByOrder.has(key)) return;
    setStars(ul, 0);
    ul.querySelectorAll(".star").forEach((li) => {
      li.addEventListener("click", () => {
        const next = Number(li.getAttribute("data-value")) || 0;
        const current = Number(selectedRatings.get(key) || 0) || 0;
        const value = current === next ? 0 : next;
        selectedRatings.set(key, value);
        setStars(ul, value);
      });
    });
  });

  document.querySelectorAll("button[data-review-submit][data-review-order]").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      e.preventDefault();
      const key = String(btn.getAttribute("data-review-order") || "").trim();
      if (!key) return;
      const card = btn.closest('.kyloRatingCard[data-review-order]');
      if (!card) return;
      const status = card.querySelector("[data-review-status]");
      const textarea = card.querySelector("textarea[data-review-text]");
      const ul = card.querySelector('ul[data-review-stars][data-review-order]');
      const rating = Number(selectedRatings.get(key) || 0) || 0;
      const content = String(textarea?.value || "").trim();

      const setStatus = (msg, tone) => {
        if (!status) return;
        status.textContent = msg;
        status.style.color = tone === "error" ? "#ef4444" : tone === "success" ? "#22c55e" : "";
      };

      if (!reviewsTableAvailable) {
        setStatus("Feedback system is not set up yet.", "error");
        return;
      }

      if (reviewsByOrder.has(key)) {
        setStatus("You already left feedback for this order.", "error");
        return;
      }

      if (rating < 1 || rating > 5) {
        setStatus("Please select a star rating.", "error");
        return;
      }
      if (content.length < 3) {
        setStatus("Please write your feedback.", "error");
        return;
      }

      btn.setAttribute("disabled", "true");
      if (textarea) textarea.setAttribute("disabled", "true");
      if (ul) ul.style.pointerEvents = "none";
      setStatus("Submitting…", "info");

      try {
        const { data: existing, error: checkErr } = await supabase
          .from("order_reviews")
          .select("id")
          .eq("user_id", user.id)
          .eq("order_id", key)
          .maybeSingle();
        if (!checkErr && existing?.id) {
          reviewsByOrder.set(key, existing);
          setStatus("You already left feedback for this order.", "error");
          return;
        }

        const payload = {
          user_id: user.id,
          username: currentUsername,
          display_name: currentDisplayName,
          order_id: key,
          rating,
          content,
        };
        const { data: inserted, error: insertErr } = await supabase.from("order_reviews").insert(payload).select("*").maybeSingle();
        if (insertErr) throw insertErr;
        if (inserted) reviewsByOrder.set(key, inserted);
        setStatus("Submitted.", "success");
      } catch (err) {
        setStatus(String(err?.message || "Failed to submit feedback."), "error");
        if (textarea) textarea.removeAttribute("disabled");
        if (ul) ul.style.pointerEvents = "";
      } finally {
        btn.removeAttribute("disabled");
      }
    });
  });

  document.querySelectorAll('div[aria-hidden="true"]').forEach((el) => {
    const label = String(el.textContent || "").trim().toLowerCase();
    if (!label) return;
    if (label !== "copy all" && label !== "save file") return;
    el.addEventListener("click", async (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (label === "save file") return;
      const root = el.closest("[data-order-id]");
      if (!root) return;
      const textEl = root.querySelector(".whitespace-pre-wrap");
      const rawText = textEl ? textEl.textContent : "";
      const text = String(rawText || "").trim();
      if (!text) return;
      try {
        await navigator.clipboard.writeText(text);
      } catch (_) {}
    });
  });
};

main();
