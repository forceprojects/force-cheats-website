const escapeHtml = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const normalizeStoreConfig = (input) => {
  const cfg = input && typeof input === 'object' ? input : {};
  const homeCards = Array.isArray(cfg.homeCards) ? cfg.homeCards : [];
  const products = Array.isArray(cfg.products) ? cfg.products : [];
  return { homeCards, products };
};

const extractSlugFromMiniHref = (rawHref) => {
  const raw = String(rawHref || '').trim();
  if (!raw) return '';
  if (/^(https?:)?\/\//i.test(raw)) return '';
  if (raw.startsWith('/')) return '';
  if (raw.startsWith('#')) return raw.replace(/^#/, '').trim();
  const m = raw.match(/product(?:\.html)?\?(?:=)?([^&#]+)/i);
  if (m && m[1]) {
    try {
      return decodeURIComponent(m[1]).trim();
    } catch (_) {
      return String(m[1]).trim();
    }
  }
  if (raw.includes('?') || raw.includes('#') || raw.includes('.html')) return '';
  return raw;
};

const normalizeImageUrl = (rawUrl) => {
  const u = String(rawUrl || '').trim();
  if (!u) return '';
  if (/^(https?:)?\/\//i.test(u)) return u;
  if (u.startsWith('data:')) return u;
  if (u.startsWith('/')) return u;
  return '/' + u.replace(/^\.?\//, '');
};

const sanitizeGuideHtml = (html) => {
  const s = String(html || '');
  return s.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
};

const renderHomeCardsGrid = (cfg) => {
  const cards = Array.isArray(cfg.homeCards) ? cfg.homeCards : [];
  return cards
    .map((c, idx) => {
      const title = String(c?.title || `Home Card #${idx + 1}`);
      const img = normalizeImageUrl(c?.image || '');
      const key = String(c?.href || '').trim();
      const hash = (key || 'card-' + String(idx + 1)).replace(/^#/, '');
      return `
        <li class="cStoreGame">
          <a href="#${escapeHtml(hash)}" class="homeCardLink" data-action="openHome" data-index="${idx}">
            <div class="cStoreGame_image">
              <img src="${escapeHtml(img || 'code-theme/images/logo.webp')}" alt="${escapeHtml(title || 'Product')}" loading="lazy" width="348" height="450" decoding="async">
            </div>
            <span class="cStoreGame_name ipsHide">${escapeHtml(title || 'Product')}</span>
          </a>
        </li>
      `;
    })
    .join('');
};

const renderProductCards = (productsForHome, productsBySlug) => {
  const items = Array.isArray(productsForHome) ? productsForHome : [];
  return items
    .map((mini, idx) => {
      const slug = extractSlugFromMiniHref(mini?.href);
      if (!slug) return '';
      const product = productsBySlug.get(slug.toLowerCase()) || null;
      const name = String(mini?.name || product?.name || slug);
      const img = normalizeImageUrl(product?.primaryImage || mini?.image || '');
      return `
        <li class="ipsCarousel_item cNexusProduct cNexusProduct_mini">
          <a href="javascript:void(0)" class="cNexusPackage_img" data-action="openProduct" data-slug="${escapeHtml(slug)}">
            <img src="${escapeHtml(img || '/images/no_image_placeholder.svg')}" class="ipsImage" width="300" height="auto" alt="${escapeHtml(
        name
      )}" loading="eager" decoding="async" style="display:block;max-width:100%;height:auto;">
          </a>
          <div>
            <div class="cStorePackage_header">
              <h2 class="cNexusProduct_title ipsType_normal ipsType_unbold ipsType_reset ipsType_blendLinks">${escapeHtml(name)}</h2>
            </div>
            <a href="javascript:void(0)" class="cStorePackage_button" data-action="openProduct" data-slug="${escapeHtml(slug)}">
              <i class="fa fa-book" aria-hidden="true"></i> Open Guide
            </a>
          </div>
        </li>
      `;
    })
    .filter(Boolean)
    .join('');
};

const renderGuidesForProduct = (product) => {
  const guides = Array.isArray(product?.guides) ? product.guides : [];
  if (!guides.length) {
    return `
      <div class="ipsBox" style="padding:24px;text-align:center;font-weight:700;opacity:.75;">
        No guides available
      </div>
    `;
  }

  return guides
    .map((g) => {
      const title = String(g?.title || '').trim();
      const body = sanitizeGuideHtml(g?.bodyHtml || '');
      const callouts = Array.isArray(g?.callouts) ? g.callouts : [];

      const calloutsHtml = callouts
        .map((c) => {
          const color = String(c?.color || '').trim().toLowerCase();
          const html = sanitizeGuideHtml(c?.html || '');
          if (!html.trim()) return '';
          if (color === 'red') return `<div class="HAZ_stepBox">${html}</div>`;
          return `<div class="HAZ_warning">${html}</div>`;
        })
        .filter(Boolean)
        .join('');

      return `
        <div class="HAZ_container">
          ${title ? `<h2>${escapeHtml(title)}</h2>` : ''}
          <div class="HAZ_stepBox HAZ_stepGroup">${body || '<p></p>'}</div>
          ${calloutsHtml}
        </div>
      `;
    })
    .join('');
};

const initGuidesPage = async () => {
  const sectionTitle = document.querySelector('.cStore_wrapper .cStore_title');
  const grid = document.getElementById('product-grid');
  const categoryWrapper = document.getElementById('product-category-view');
  if (!sectionTitle || !grid || !categoryWrapper) return;

  const ensureDynamicStyles = () => {
    if (document.getElementById('kyloGuidesDynamicStyle')) return;
    const style = document.createElement('style');
    style.id = 'kyloGuidesDynamicStyle';
    style.textContent =
      '#guidesContent img,#guidesContent video{max-width:100%;height:auto;display:block}' +
      '#guidesContent iframe{max-width:100%;width:100%;height:auto;display:block;aspect-ratio:16/9}' +
      '.HAZ_stepBox,.HAZ_warning{overflow:hidden}' +
      '.HAZ_stepBox img,.HAZ_warning img{border-radius:6px}';
    document.head.appendChild(style);
  };
  ensureDynamicStyles();

  const supabase = window.kyloGuidesSupabase || null;
  if (!supabase) {
    categoryWrapper.style.display = 'block';
    categoryWrapper.innerHTML =
      '<div class="ipsBox" style="padding:24px;text-align:center;font-weight:700;opacity:.75;">Supabase is not configured.</div>';
    return;
  }

  const { data, error } = await supabase.from('site_kv').select('value').eq('key', 'store_config').maybeSingle();
  if (error) {
    categoryWrapper.style.display = 'block';
    categoryWrapper.innerHTML =
      '<div class="ipsBox" style="padding:24px;text-align:center;font-weight:700;opacity:.75;">Failed to load guides.</div>';
    return;
  }

  const cfg = normalizeStoreConfig(data?.value);
  const productsBySlug = new Map(
    (Array.isArray(cfg.products) ? cfg.products : [])
      .map((p) => {
        const slug = String(p?.slug || '').trim();
        return slug ? [slug.toLowerCase(), p] : null;
      })
      .filter(Boolean)
  );

  const showHomeList = () => {
    sectionTitle.textContent = 'Guides';
    grid.style.display = 'grid';
    grid.innerHTML = renderHomeCardsGrid(cfg);
    categoryWrapper.style.display = 'none';
    categoryWrapper.innerHTML = '';
    if (history.replaceState) history.replaceState(null, '', location.pathname + location.search);
  };

  const showHome = (index) => {
    const idx = Number(index);
    const cards = Array.isArray(cfg.homeCards) ? cfg.homeCards : [];
    const card = Number.isFinite(idx) && idx >= 0 && idx < cards.length ? cards[idx] : null;
    if (!card) return;

    sectionTitle.textContent = String(card.title || 'Guides');
    grid.style.display = 'none';
    categoryWrapper.style.display = 'block';

    const products = Array.isArray(card.products) ? card.products : [];
    categoryWrapper.innerHTML =
      '<div class="ipsBox" style="margin-bottom: 1rem;">' +
      '<div style="display:flex;align-items:center;justify-content:flex-start;gap:10px;padding:10px 12px;">' +
      '<button type="button" id="guidesBack" class="ipsButton ipsButton_small ipsButton_light">Back</button>' +
      '</div>' +
      '</div>' +
      '<div id="guidesProductsWrap" class="ipsWidget ipsWidget_horizontal ipsBox"><div class="ipsWidget_inner"><div class="ipsPad_half">' +
      '<ul id="guidesProductsList" class="ipsList_reset cNexusCategory_grid ipsClearfix" data-role="carouselItems">' +
      renderProductCards(products, productsBySlug) +
      '</ul>' +
      '</div></div></div>' +
      '<div id="guidesContent" style="margin-top:16px;"></div>';

    categoryWrapper.querySelector('#guidesBack')?.addEventListener('click', showHomeList);
  };

  const showProduct = (slug) => {
    const s = String(slug || '').trim();
    if (!s) return;
    const product = productsBySlug.get(s.toLowerCase()) || null;
    const content = categoryWrapper.querySelector('#guidesContent');
    const wrap = categoryWrapper.querySelector('#guidesProductsWrap');
    if (!content) return;
    content.innerHTML = product ? renderGuidesForProduct(product) : '<div class="ipsBox ipsPad">No guides available</div>';
    if (wrap) wrap.style.display = 'none';
    if (history.replaceState) history.replaceState(null, '', location.pathname + location.search + '#' + encodeURIComponent(s));
    if (content.scrollIntoView) setTimeout(() => content.scrollIntoView({ behavior: 'auto', block: 'start' }), 0);
  };

  grid.addEventListener('click', (e) => {
    const t = e.target.closest('[data-action="openHome"], .homeCardLink');
    if (!t) return;
    e.preventDefault();
    showHome(t.getAttribute('data-index'));
  });

  categoryWrapper.addEventListener('click', (e) => {
    const t = e.target.closest('[data-action="openProduct"]');
    if (!t) return;
    e.preventDefault();
    showProduct(t.getAttribute('data-slug'));
  });

  const hash = decodeURIComponent(String(location.hash || '').replace('#', '').trim());
  if (hash) {
    const cards = Array.isArray(cfg.homeCards) ? cfg.homeCards : [];
    const idx = cards.findIndex((c) => {
      const products = Array.isArray(c?.products) ? c.products : [];
      return products.some((m) => extractSlugFromMiniHref(m?.href).toLowerCase() === hash.toLowerCase());
    });
    if (idx >= 0) {
      showHome(idx);
      setTimeout(() => showProduct(hash), 0);
      return;
    }
  }

  showHomeList();
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initGuidesPage);
} else {
  initGuidesPage();
}
