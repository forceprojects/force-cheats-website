(function () {
  const isHidden = (el) => el.classList.contains('ipsHide');
  const show = (el) => el.classList.remove('ipsHide');
  const hide = (el) => el.classList.add('ipsHide');

  const withTimeout = async (promise, ms, label) => {
    let timer = null;
    try {
      const timeout = new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(label || 'Request timed out')), Math.max(1, Number(ms) || 1));
      });
      return await Promise.race([promise, timeout]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  };

  const getSupabase = () => {
    const existing = window.kyloSupabase;
    if (existing && existing.auth) return existing;
    const url = String(window.kyloSupabaseUrl || '').trim();
    const key = String(window.kyloSupabaseAnonKey || '').trim();
    const createClient = window.supabase && typeof window.supabase.createClient === 'function' ? window.supabase.createClient : null;
    if (!url || !key || !createClient) return null;
    const sb = createClient(url, key, { auth: { persistSession: true, storage: window.localStorage } });
    window.kyloSupabase = sb;
    return sb;
  };

  const readUserFromLocalSession = () => {
    try {
      const url = String(window.kyloSupabaseUrl || '').trim();
      const knownKey = url ? `sb-${String(url).replace(/^https?:\/\//i, '').split('.')[0]}-auth-token` : '';
      const keys = [];
      if (knownKey) keys.push(knownKey);
      for (let i = 0; i < window.localStorage.length; i += 1) {
        const k = String(window.localStorage.key(i) || '');
        if (/^sb-[a-z0-9]+-auth-token$/i.test(k) && !keys.includes(k)) keys.push(k);
      }
      for (const key of keys) {
        const raw = window.localStorage.getItem(key);
        if (!raw) continue;
        const data = JSON.parse(raw);
        const session = data && (data.currentSession || data.session || data);
        const user = (session && session.user) || data.user || null;
        if (user && (user.id || user.email)) return user;
      }
    } catch (_) {}
    return null;
  };

  const getCurrentUser = async () => {
    const direct = window.currentUser;
    if (direct && (direct.id || direct.email)) return direct;

    const sb = getSupabase();
    if (sb && sb.auth) {
      try {
        const res = await withTimeout(sb.auth.getUser(), 8000, 'Timed out while checking sign-in status');
        const u = res && res.data && res.data.user ? res.data.user : null;
        if (u) return u;
      } catch (_) {}
      try {
        const res = await withTimeout(sb.auth.getSession(), 8000, 'Timed out while reading session');
        const u = res && res.data && res.data.session && res.data.session.user ? res.data.session.user : null;
        if (u) return u;
      } catch (_) {}
    }

    return readUserFromLocalSession();
  };

  const getSiteUrl = (path) => {
    try {
      return new URL(path, window.location.href).href;
    } catch (_) {
      return path;
    }
  };

  const getMainDrawerList = (drawer) => {
    if (!drawer) return null;
    const lists = Array.from(drawer.querySelectorAll('ul.ipsDrawer_list'));
    if (!lists.length) return null;
    return lists[0] || null;
  };

  const removeInjectedAuthItems = (drawer) => {
    if (!drawer) return;
    drawer.querySelectorAll('[data-kylo-drawer-auth="1"]').forEach((el) => el.remove());
  };

  const insertDrawerItemAtTop = (list, el) => {
    if (!list || !el) return;
    el.setAttribute('data-kylo-drawer-auth', '1');
    list.insertBefore(el, list.firstChild);
  };

  const makeLi = () => document.createElement('li');

  const makeLink = (label, href, className) => {
    const li = makeLi();
    const a = document.createElement('a');
    a.href = href;
    a.className = className;
    a.textContent = label;
    li.appendChild(a);
    return li;
  };

  const makeButton = (label, className, attrs = {}) => {
    const li = makeLi();
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = className;
    btn.textContent = label;
    Object.keys(attrs || {}).forEach((k) => {
      try {
        btn.setAttribute(k, String(attrs[k]));
      } catch (_) {}
    });
    li.appendChild(btn);
    return li;
  };

  const signInWithGoogle = async () => {
    const sb = getSupabase();
    if (!sb || !sb.auth) {
      alert('Sign in is not available on this page.');
      return;
    }
    const { error } = await sb.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.href } });
    if (error) throw error;
  };

  const signInWithEmailPassword = async (email, password) => {
    const sb = getSupabase();
    if (!sb || !sb.auth) {
      alert('Sign in is not available on this page.');
      return;
    }
    const { error } = await sb.auth.signInWithPassword({ email, password });
    if (error) throw error;
  };

  const signOut = async () => {
    const sb = getSupabase();
    if (sb && sb.auth && typeof sb.auth.signOut === 'function') {
      await sb.auth.signOut();
    } else {
      try {
        const keysToRemove = [];
        for (let i = 0; i < window.localStorage.length; i += 1) {
          const k = String(window.localStorage.key(i) || '');
          if (/^sb-[a-z0-9]+-auth-token$/i.test(k)) keysToRemove.push(k);
        }
        keysToRemove.forEach((k) => window.localStorage.removeItem(k));
      } catch (_) {}
    }
    window.currentUser = null;
    window.location.reload();
  };

  const bindMobileDrawerAuthInteractions = (drawer) => {
    if (!drawer) return;
    if (drawer.dataset.kyloMobileAuthBound === '1') return;
    drawer.dataset.kyloMobileAuthBound = '1';

    drawer.addEventListener(
      'click',
      async (e) => {
        const btn = e.target && e.target.closest ? e.target.closest('[data-kylo-auth-toggle]') : null;
        if (!btn) return;
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        const wrap = drawer.querySelector('[data-kylo-auth-form="wrap"]');
        if (!wrap) return;
        wrap.classList.toggle('ipsHide');
      },
      true
    );

    drawer.addEventListener(
      'click',
      async (e) => {
        const btn = e.target && e.target.closest ? e.target.closest('[data-kylo-google]') : null;
        if (!btn) return;
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        try {
          await signInWithGoogle();
        } catch (err) {
          alert((err && err.message) || 'Google login failed');
        }
      },
      true
    );

    drawer.addEventListener(
      'submit',
      async (e) => {
        const form = e.target;
        if (!form || !form.getAttribute) return;
        if (form.getAttribute('data-kylo-auth-form') !== '1') return;
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        const email = String(form.querySelector('input[name="auth"]') && form.querySelector('input[name="auth"]').value ? form.querySelector('input[name="auth"]').value : '').trim();
        const password = String(form.querySelector('input[name="password"]') && form.querySelector('input[name="password"]').value ? form.querySelector('input[name="password"]').value : '');
        if (!email || !password) {
          alert('Please enter email and password.');
          return;
        }
        try {
          await signInWithEmailPassword(email, password);
          window.location.reload();
        } catch (err) {
          alert((err && err.message) || 'Login failed');
        }
      },
      true
    );

    drawer.addEventListener(
      'click',
      async (e) => {
        const btn = e.target && e.target.closest ? e.target.closest('[data-kylo-signout]') : null;
        if (!btn) return;
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        try {
          await signOut();
        } catch (err) {
          alert('Logout failed: ' + ((err && err.message) || err));
        }
      },
      true
    );
  };

  const renderMobileDrawerAuth = async (drawer) => {
    const list = getMainDrawerList(drawer);
    if (!list) return;

    bindMobileDrawerAuthInteractions(drawer);
    removeInjectedAuthItems(drawer);

    const makeLabelLink = (text, href, attrs = {}) => {
      const li = makeLi();
      const a = document.createElement('a');
      a.href = href;
      a.textContent = text;
      Object.keys(attrs || {}).forEach((k) => {
        try {
          a.setAttribute(k, String(attrs[k]));
        } catch (_) {}
      });
      li.appendChild(a);
      return li;
    };

    const makeAuthFormLi = () => {
      const li = makeLi();
      li.classList.add('ipsHide');
      li.setAttribute('data-kylo-auth-form', 'wrap');

      const form = document.createElement('form');
      form.setAttribute('data-kylo-auth-form', '1');
      form.setAttribute('action', '#');
      form.setAttribute('method', 'post');
      form.setAttribute('accept-charset', 'utf-8');

      const pad = document.createElement('div');
      pad.className = 'ipsPad ipsForm ipsForm_vertical';

      const title = document.createElement('h4');
      title.className = 'ipsType_sectionHead';
      title.textContent = 'Sign In';
      pad.appendChild(title);

      const listEl = document.createElement('ul');
      listEl.className = 'ipsList_reset';

      const emailLi = document.createElement('li');
      emailLi.className = 'ipsFieldRow ipsFieldRow_noLabel ipsFieldRow_fullWidth';
      const email = document.createElement('input');
      email.type = 'email';
      email.name = 'auth';
      email.placeholder = 'Email Address';
      email.autocomplete = 'email';
      emailLi.appendChild(email);
      listEl.appendChild(emailLi);

      const passLi = document.createElement('li');
      passLi.className = 'ipsFieldRow ipsFieldRow_noLabel ipsFieldRow_fullWidth';
      const pass = document.createElement('input');
      pass.type = 'password';
      pass.name = 'password';
      pass.placeholder = 'Password';
      pass.autocomplete = 'current-password';
      passLi.appendChild(pass);
      listEl.appendChild(passLi);

      const submitLi = document.createElement('li');
      submitLi.className = 'ipsFieldRow ipsFieldRow_fullWidth';
      const submitBtn = document.createElement('button');
      submitBtn.type = 'submit';
      submitBtn.className = 'ipsButton ipsButton_primary ipsButton_small ipsButton_fullWidth';
      submitBtn.textContent = 'Sign In';
      submitLi.appendChild(submitBtn);
      listEl.appendChild(submitLi);

      pad.appendChild(listEl);
      form.appendChild(pad);
      li.appendChild(form);
      return li;
    };

    const user = await getCurrentUser();
    if (!user) {
      const formLi = makeAuthFormLi();
      const googleLi = makeLabelLink('Sign in with Google', '#', { 'data-kylo-google': '1' });
      const signUpLi = makeLabelLink('Sign Up', getSiteUrl('register.html'));
      const signInLi = makeLabelLink('Sign In', '#', { 'data-kylo-auth-toggle': '1' });
      insertDrawerItemAtTop(list, googleLi);
      insertDrawerItemAtTop(list, formLi);
      insertDrawerItemAtTop(list, signUpLi);
      insertDrawerItemAtTop(list, signInLi);
      return;
    }

    insertDrawerItemAtTop(list, makeLabelLink('Sign Out', '#', { 'data-kylo-signout': '1' }));
    insertDrawerItemAtTop(list, makeLabelLink('Account Settings', getSiteUrl('settings.html?overview')));
    insertDrawerItemAtTop(list, makeLabelLink('My Profile', getSiteUrl('profile.html')));
    insertDrawerItemAtTop(list, makeLabelLink('My Purchases', getSiteUrl('purchases.html')));
  };

  const ensureTopLayer = (drawer) => {
    if (!drawer || !drawer.ownerDocument) return;
    try {
      if (drawer.parentNode !== drawer.ownerDocument.body) drawer.ownerDocument.body.appendChild(drawer);
      else drawer.ownerDocument.body.appendChild(drawer);
    } catch (_) {}
    try {
      drawer.style.position = 'fixed';
      drawer.style.top = '0';
      drawer.style.right = '0';
      drawer.style.bottom = '0';
      drawer.style.left = '0';
      drawer.style.zIndex = '2147483647';
      drawer.style.transform = 'none';
    } catch (_) {}
    try {
      const menu = drawer.querySelector('.ipsDrawer_menu');
      if (menu) {
        menu.style.position = 'fixed';
        menu.style.top = '0';
        menu.style.right = '0';
        menu.style.bottom = '0';
        menu.style.left = '';
        menu.style.zIndex = '2147483647';
        menu.style.transform = 'none';
        menu.style.overflow = 'visible';
      }
    } catch (_) {}
  };

  const getDrawer = (selector) => {
    const sel = String(selector || '').trim();
    if (!sel) return null;
    try {
      return document.querySelector(sel);
    } catch (_) {
      return null;
    }
  };

  const bind = () => {
    document.querySelectorAll('[data-ipsdrawer][data-ipsdrawer-drawerelem]').forEach((li) => {
      const trigger = li.querySelector('a');
      if (!trigger || trigger.dataset.drawerBound === '1') return;
      trigger.dataset.drawerBound = '1';
      trigger.setAttribute('href', '#');

      const drawerSel = li.getAttribute('data-ipsdrawer-drawerelem') || '';
      const drawer = getDrawer(drawerSel);
      if (!drawer) return;

      trigger.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (isHidden(drawer)) {
          ensureTopLayer(drawer);
          Promise.resolve(renderMobileDrawerAuth(drawer)).catch(() => {});
          show(drawer);
        } else {
          hide(drawer);
        }
      });
    });

    document.querySelectorAll('#elMobileDrawer [data-action=\"close\"], #elMobileDrawer .ipsDrawer_close').forEach((btn) => {
      if (btn.dataset.drawerCloseBound === '1') return;
      btn.dataset.drawerCloseBound = '1';
      btn.setAttribute('href', '#');
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const drawer = document.getElementById('elMobileDrawer');
        if (drawer) hide(drawer);
      });
    });

    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      const drawer = document.getElementById('elMobileDrawer');
      if (drawer && !isHidden(drawer)) hide(drawer);
    });

    const drawer = document.getElementById('elMobileDrawer');
    if (drawer) Promise.resolve(renderMobileDrawerAuth(drawer)).catch(() => {});
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind);
  else bind();
})();
