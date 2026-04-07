(async function () {
  if (window.__kyloThemeApplied) return;
  window.__kyloThemeApplied = true;

  const THEME_CACHE_KEY = "kylo_theme_config";

  const escapeHtml = (value) =>
    String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");

  const setVar = (name, value) => {
    try {
      document.documentElement.style.setProperty(name, value, "important");
    } catch (_) {}
  };

  const normalizeHex = (value) => {
    const s = String(value || "").trim();
    if (!/^#[0-9a-fA-F]{6}$/.test(s)) return "";
    return s.toLowerCase();
  };

  const hexToRgbTriplet = (hex) => {
    const h = normalizeHex(hex);
    if (!h) return "";
    const r = parseInt(h.slice(1, 3), 16);
    const g = parseInt(h.slice(3, 5), 16);
    const b = parseInt(h.slice(5, 7), 16);
    return `${r}, ${g}, ${b}`;
  };

  const normalizeTheme = (cfg) => {
    const primaryHex = normalizeHex(cfg?.primaryHex) || "";
    const secondaryHex = normalizeHex(cfg?.secondaryHex) || "";
    const accentHex = normalizeHex(cfg?.accentHex) || primaryHex || "";
    return { primaryHex, secondaryHex, accentHex };
  };

  const applyTheme = (cfg) => {
    const theme = normalizeTheme(cfg);
    const primaryHex = theme.primaryHex;
    const secondaryHex = theme.secondaryHex;
    const accentHex = theme.accentHex;

    if (primaryHex) setVar("--theme-brand_primary", hexToRgbTriplet(primaryHex));
    if (secondaryHex) setVar("--theme-brand_secondary", hexToRgbTriplet(secondaryHex));
    if (accentHex) setVar("--theme-brand_accent_hex", accentHex);

    if (primaryHex && secondaryHex) {
      const gradient = `linear-gradient(60deg, ${secondaryHex}, ${primaryHex})`;
      setVar("--theme-brand_gradient", gradient);
      setVar("--theme-brand_gradient_webkit", gradient);
    }
  };

  const getSupabase = async () => {
    let supabase = window.kyloSupabase || window.kyloGuidesSupabase || null;
    if (supabase) return supabase;
    const defaultSupabaseUrl = "https://tjpxmbfekgnxtyujvyvx.supabase.co";
    const defaultSupabaseAnonKey = "sb_publishable_MY0T9tn8TU567ZRsnoZHyA_gGqyVs2W";
    const supabaseUrl = String(window.kyloSupabaseUrl || defaultSupabaseUrl).trim();
    const supabaseAnonKey = String(window.kyloSupabaseAnonKey || defaultSupabaseAnonKey).trim();
    if (!supabaseUrl || !supabaseAnonKey) return null;
    const mod = await import("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.49.1/+esm");
    const createClient = mod?.createClient;
    if (typeof createClient !== "function") return null;
    supabase = createClient(supabaseUrl, supabaseAnonKey, { auth: { persistSession: true, storage: window.localStorage } });
    window.kyloSupabase = window.kyloSupabase || supabase;
    return supabase;
  };

  const normalizeStoreConfig = (input) => {
    const cfg = input && typeof input === "object" ? input : {};
    const homeCards = Array.isArray(cfg.homeCards) ? cfg.homeCards : [];
    const categories = Array.isArray(cfg.categories) ? cfg.categories : [];
    const products = Array.isArray(cfg.products) ? cfg.products : [];
    return { homeCards, categories, products };
  };

  const extractProductsForFooter = (storeConfig) => {
    const cfg = normalizeStoreConfig(storeConfig);
    const fromProducts = cfg.products
      .map((p) => ({
        slug: String(p?.slug || "").trim(),
        name: String(p?.name || p?.slug || "").trim(),
      }))
      .filter((p) => p.slug && p.name);

    if (fromProducts.length) return fromProducts.slice(0, 8);

    const out = [];
    const seen = new Set();
    cfg.homeCards.forEach((card) => {
      const items = Array.isArray(card?.products) ? card.products : [];
      items.forEach((it) => {
        const slug = String(it?.slug || it?.product || it?.href || it || "").trim();
        const name = String(it?.name || it?.title || slug || "").trim();
        const s = slug.toLowerCase();
        if (!slug || !name || seen.has(s)) return;
        seen.add(s);
        out.push({ slug, name });
      });
    });
    return out.slice(0, 8);
  };

  const renderSupportedCheatsFooter = (items) => {
    const list = Array.isArray(items) ? items : [];
    if (!list.length) return;

    const columns = document.querySelectorAll("li.cFooterLinks_column");
    columns.forEach((col) => {
      const h2 = col.querySelector("h2.cFooterLinks_title");
      if (!h2) return;
      if (String(h2.textContent || "").trim().toLowerCase() !== "supported cheats") return;
      const box = col.querySelector("div.cFooterLinks");
      if (!box) return;
      const left = list.slice(0, 4);
      const right = list.slice(4, 8);
      const li = (p) =>
        `<li><a href="/product?=${encodeURIComponent(p.slug)}">${escapeHtml(p.name)}</a></li>`;
      box.innerHTML = `<ul class="cFooterLinks_list">${left.map(li).join("")}</ul><ul class="cFooterLinks_list">${right.map(li).join("")}</ul>`;
    });
  };

  try {
    const cached = JSON.parse(String(window.localStorage?.getItem(THEME_CACHE_KEY) || "null"));
    if (cached && typeof cached === "object") applyTheme(cached);
  } catch (_) {}

  try {
    const supabase = await getSupabase();
    if (!supabase) return;
    const { data, error } = await supabase.from("site_kv").select("value").eq("key", "theme_config").maybeSingle();
    const v = !error ? data?.value : null;
    if (v && typeof v === "object") {
      const normalized = normalizeTheme(v);
      applyTheme(normalized);
      try {
        if (normalized.primaryHex && normalized.secondaryHex) window.localStorage?.setItem(THEME_CACHE_KEY, JSON.stringify(normalized));
      } catch (_) {}
    }

    const { data: storeData, error: storeError } = await supabase
      .from("site_kv")
      .select("value")
      .eq("key", "store_config")
      .maybeSingle();
    const products = !storeError ? extractProductsForFooter(storeData?.value) : [];
    renderSupportedCheatsFooter(products);
  } catch (_) {}
})();
