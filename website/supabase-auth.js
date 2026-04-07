const supabaseUrl = "https://tjpxmbfekgnxtyujvyvx.supabase.co";
const supabaseAnonKey = "sb_publishable_MY0T9tn8TU567ZRsnoZHyA_gGqyVs2W";

const canUseSupabase = () => Boolean(supabaseUrl && supabaseAnonKey);

const createSupabase = (storage) => {
  const createClient = window.supabase?.createClient;
  if (typeof createClient !== "function") return null;
  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: true, storage }
  });
};

const supabase = canUseSupabase() ? createSupabase(window.localStorage) : null;
window.kyloSupabase = supabase;
window.kyloSupabaseUrl = supabaseUrl;
window.kyloSupabaseAnonKey = supabaseAnonKey;

const desktopSignIn = document.getElementById("elUserSignIn");
const mobileSignIn = document.getElementById("elSigninButton_mobile");
const signUpDesktop = document.getElementById("elRegisterButton");
const signUpMobile = document.getElementById("elRegisterButton_mobile");
const menu = document.getElementById("elUserSignIn_menu");

const originalDesktopSignInHtml = desktopSignIn ? desktopSignIn.innerHTML : null;
const originalMobileSignInText = mobileSignIn ? mobileSignIn.textContent : null;
const originalMenuHtml = menu ? menu.innerHTML : null;

const getRedirectTo = () => window.location.href;

const ensureMiniCardStyles = () => {
  if (document.getElementById("supabaseMiniCardStyles")) return;
  const style = document.createElement("style");
  style.id = "supabaseMiniCardStyles";
  style.textContent = `
#elUserSignIn .supabaseUserAvatar{width:2.65em;height:2.65em;border-radius:50%;object-fit:cover;margin-right:.8em;vertical-align:middle;display:inline-block}
#elUserSignIn .supabaseUserLabel{vertical-align:middle;font-size:1.1em;font-weight:600;line-height:1}
#elUserSignIn_menu.supabaseMiniMenu{width:340px;max-width:calc(100vw - 24px);font-family:'Inter',sans-serif}
#elUserSignIn_menu .supabaseMiniCard{position:relative;padding:14px;border-radius:10px;background:#1C1E25;border:1px solid rgba(255,255,255,.06);font-family:'Inter',sans-serif}
#elUserSignIn_menu .supabaseMiniHeader{display:flex;align-items:center;gap:12px;margin-bottom:12px}
#elUserSignIn_menu .supabaseMiniAvatar{width:44px;height:44px;border-radius:14px;background:#d946ef;color:#fff;font-weight:700;display:flex;align-items:center;justify-content:center;overflow:hidden;flex:0 0 auto}
#elUserSignIn_menu .supabaseMiniAvatar img{width:100%;height:100%;object-fit:cover}
#elUserSignIn_menu .supabaseMiniId{font-size:11px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:rgba(255,255,255,.55);line-height:1;margin-bottom:4px}
#elUserSignIn_menu .supabaseMiniName{font-size:18px;font-weight:700;line-height:1.1}
#elUserSignIn_menu .supabaseMiniActions{display:flex;flex-direction:column;gap:10px;margin-top:6px}
#elUserSignIn_menu .supabaseMiniAction{width:100%;display:flex;align-items:center;justify-content:flex-start;gap:10px;padding:12px 12px;border-radius:12px;background:#23262F;border:0;color:inherit;cursor:pointer;font-weight:700;font-size:14px}
#elUserSignIn_menu .supabaseMiniAction:hover{background:#2B2E39}
#elUserSignIn_menu .supabaseMiniAction:active{transform:translateY(1px)}
#elUserSignIn_menu .supabaseMiniActionLabel{flex:1;min-width:0;text-align:left}
#elUserSignIn_menu .supabaseMiniActionIcon{width:34px;height:34px;border-radius:12px;background:#23262F;border:0;display:flex;align-items:center;justify-content:center;transition:background-color .18s ease;flex:0 0 auto}
#elUserSignIn_menu .supabaseMiniActionIcon i{color:rgba(255,255,255,.85)}
#elUserSignIn_menu .supabaseMiniAction:hover .supabaseMiniActionIcon{background:var(--theme-brand_accent_hex,#1d68d7)}
#elUserSignIn_menu .supabaseMiniAction:hover .supabaseMiniActionIcon i{color:#fff}
#elUserSignIn_menu .supabaseMiniSeparator{height:1px;background:rgba(255,255,255,.07);margin:18px 0;border-radius:1px}
#elUserSignIn_menu .supabaseMiniFooter{display:flex !important;justify-content:flex-end !important;align-items:center;width:100%;margin-top:0}
#elUserSignIn_menu .supabaseMiniSignOut{background:transparent;border:0;color:rgba(255,255,255,.55);font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;display:inline-flex;align-items:center;gap:8px;padding:0;cursor:pointer;text-align:right;margin:0;margin-left:auto !important;line-height:1;transition:color .18s ease}
#elUserSignIn_menu .supabaseMiniSignOut i{display:inline-block;line-height:1;font-size:12px}
#elUserSignIn_menu .supabaseMiniSignOut:hover{color:#ef4444}
`.trim();
  document.head.appendChild(style);
};

const getSiteIndexUrl = () => new URL("../index.html", window.location.href).href;
const getSiteProfileUrl = () => new URL("../profile.html", window.location.href).href;
const getSiteSettingsUrl = () => new URL("../settings.html?overview", window.location.href).href;
const getSitePurchasesUrl = () => new URL("../purchases.html", window.location.href).href;

const normalizeUsername = (value) => {
  const s = String(value || "").trim().toLowerCase();
  if (!s) return "";
  const cleaned = s.replace(/[^a-z0-9._-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
  return cleaned.slice(0, 32);
};

const getUserLabel = (user) => user?.user_metadata?.full_name || user?.email?.split("@")?.[0] || "Account";

const getUserAvatarUrl = (user) =>
  user?.user_metadata?.avatar_url ||
  user?.user_metadata?.picture ||
  user?.user_metadata?.picture_url ||
  user?.user_metadata?.avatar ||
  user?.user_metadata?.photo_url ||
  "";

const isProfilesTableMissingError = (error) => {
  if (!error) return false;
  const code = String(error?.code || "");
  const message = String(error?.message || "");
  return code === "PGRST205" || (message.includes("Could not find the table") && message.includes("profiles"));
};

const isDuplicateUsernameError = (error) => {
  if (!error) return false;
  const code = String(error?.code || "");
  const message = String(error?.message || "");
  return code === "23505" || message.includes("profiles_username_key") || message.includes("duplicate key value");
};

const isMissingColumnError = (error, columnName) => {
  if (!error) return false;
  const message = String(error?.message || "").toLowerCase();
  const details = String(error?.details || "").toLowerCase();
  const hint = String(error?.hint || "").toLowerCase();
  const combined = message + " " + details + " " + hint;
  const col = String(columnName || "").toLowerCase();
  if (!col) return false;
  if (combined.includes("could not find the column") && combined.includes(col)) return true;
  if (combined.includes("column") && combined.includes(col) && combined.includes("does not exist")) return true;
  if (combined.includes("schema cache") && combined.includes(col)) return true;
  return false;
};

let profilesEmailColumnAvailable = true;
let profilesReputationColumnAvailable = true;
let profilesRoleColumnAvailable = true;

const buildUsernameCandidate = (base, index) => {
  const normalizedBase = normalizeUsername(base) || "user";
  if (index <= 0) return normalizedBase.slice(0, 32);
  const suffix = "-" + String(index + 1);
  const maxBaseLen = Math.max(1, 32 - suffix.length);
  return normalizedBase.slice(0, maxBaseLen) + suffix;
};

const ensureProfileRow = async (user) => {
  if (!canUseSupabase()) return;
  if (!user?.id) return;
  const label = getUserLabel(user);
  const desiredBase = user?.user_metadata?.username || label;
  const email = String(user?.email || "").trim().toLowerCase();
  const DEFAULT_REPUTATION = 2;

  try {
    const cols = [
      "id",
      "username",
      "display_name",
      "avatar_url",
      "banner_url",
      "joined_at",
      profilesEmailColumnAvailable ? "email" : null,
      profilesReputationColumnAvailable ? "reputation" : null,
      profilesRoleColumnAvailable ? "role" : null
    ]
      .filter(Boolean)
      .join(",");
    const { data, error } = await supabase
      .from("profiles")
      .select(cols)
      .eq("id", user.id)
      .maybeSingle();
    if (error) {
      if (isProfilesTableMissingError(error)) return;
      if (profilesEmailColumnAvailable && isMissingColumnError(error, "email")) profilesEmailColumnAvailable = false;
      if (profilesReputationColumnAvailable && isMissingColumnError(error, "reputation")) profilesReputationColumnAvailable = false;
      if (profilesRoleColumnAvailable && isMissingColumnError(error, "role")) profilesRoleColumnAvailable = false;
    }

    if (data?.username) {
      try {
        if (user?.user_metadata?.username !== data.username) {
          await supabase.auth.updateUser({ data: { username: data.username } });
        }
      } catch (_) {}

      try {
        const displayName = data?.display_name || label;
        if (user?.user_metadata?.full_name !== displayName) {
          try {
            await supabase.auth.updateUser({ data: { full_name: displayName } });
          } catch (_) {}
        }

        const avatarUrl = data?.avatar_url || getUserAvatarUrl(user) || "";
        const bannerUrl = data?.banner_url || user?.user_metadata?.banner_url || user?.user_metadata?.banner || "";
        const updates = {
          display_name: displayName,
          avatar_url: avatarUrl,
          banner_url: bannerUrl,
          joined_at: data?.joined_at || user?.created_at || new Date().toISOString(),
          last_visited_at: new Date().toISOString()
        };
        if (profilesEmailColumnAvailable && email) updates.email = email;
        if (profilesReputationColumnAvailable) {
          const current = Number(data?.reputation ?? 0) || 0;
          if (current < DEFAULT_REPUTATION) updates.reputation = DEFAULT_REPUTATION;
        }
        const { error: updateError } = await supabase.from("profiles").update(updates).eq("id", user.id);
        if (updateError) {
          if (profilesEmailColumnAvailable && isMissingColumnError(updateError, "email")) profilesEmailColumnAvailable = false;
          if (profilesReputationColumnAvailable && isMissingColumnError(updateError, "reputation")) profilesReputationColumnAvailable = false;
        }
      } catch (_) {}
      return;
    }
  } catch (_) {}

  for (let i = 0; i < 50; i++) {
    const candidate = buildUsernameCandidate(desiredBase, i);
    try {
      const payload = {
        id: user.id,
        username: candidate,
        display_name: label,
        avatar_url: getUserAvatarUrl(user) || "",
        banner_url: user?.user_metadata?.banner_url || user?.user_metadata?.banner || "",
        joined_at: user?.created_at || new Date().toISOString(),
        last_visited_at: new Date().toISOString()
      };
      if (profilesEmailColumnAvailable && email) payload.email = email;
      if (profilesReputationColumnAvailable) payload.reputation = DEFAULT_REPUTATION;

      const { data, error } = await supabase
        .from("profiles")
        .insert(payload)
        .select("username")
        .maybeSingle();

      if (error) {
        if (isProfilesTableMissingError(error)) return;
        if (profilesEmailColumnAvailable && isMissingColumnError(error, "email")) profilesEmailColumnAvailable = false;
        if (profilesReputationColumnAvailable && isMissingColumnError(error, "reputation")) profilesReputationColumnAvailable = false;
        if (isDuplicateUsernameError(error)) continue;
        break;
      }

      const finalUsername = data?.username || candidate;
      try {
        if (user?.user_metadata?.username !== finalUsername) {
          await supabase.auth.updateUser({ data: { username: finalUsername } });
        }
      } catch (_) {}
      return;
    } catch (_) {}
  }
};

const getInitials = (nameOrEmail) => {
  const s = (nameOrEmail || "").trim();
  if (!s) return "A";
  const parts = s.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase();
  return (parts[0].slice(0, 1) + parts[parts.length - 1].slice(0, 1)).toUpperCase();
};

const buildSignedInMenu = (user) => {
  if (!menu) return;
  ensureMiniCardStyles();
  menu.classList.add("supabaseMiniMenu");
  menu.innerHTML = "";

  const card = document.createElement("div");
  card.className = "supabaseMiniCard";

  const header = document.createElement("div");
  header.className = "supabaseMiniHeader";

  const avatarWrap = document.createElement("div");
  avatarWrap.className = "supabaseMiniAvatar";

  const avatarUrl = getUserAvatarUrl(user);
  const label = getUserLabel(user);

  if (avatarUrl) {
    const img = document.createElement("img");
    img.alt = label;
    img.src = avatarUrl;
    avatarWrap.appendChild(img);
  } else {
    avatarWrap.textContent = getInitials(label);
  }

  const name = document.createElement("div");
  const nameWrap = document.createElement("div");
  const userIdShort = String(user?.id || "").replace(/-/g, "").slice(0, 8);
  if (userIdShort) {
    const idLine = document.createElement("div");
    idLine.className = "supabaseMiniId";
    idLine.textContent = "ID: " + userIdShort;
    nameWrap.appendChild(idLine);
  }
  name.className = "supabaseMiniName";
  name.textContent = label;
  nameWrap.appendChild(name);

  header.appendChild(avatarWrap);
  header.appendChild(nameWrap);

  const actions = document.createElement("div");
  actions.className = "supabaseMiniActions";

  const makeAction = (labelText, iconClass, onClick) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "supabaseMiniAction";
    const labelSpan = document.createElement("span");
    labelSpan.className = "supabaseMiniActionLabel";
    labelSpan.textContent = labelText;
    const iconWrap = document.createElement("span");
    iconWrap.className = "supabaseMiniActionIcon";
    const icon = document.createElement("i");
    icon.className = iconClass;
    iconWrap.appendChild(icon);
    btn.appendChild(iconWrap);
    btn.appendChild(labelSpan);
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      onClick?.();
    });
    return btn;
  };

  actions.appendChild(
    makeAction("My Profile", "fa fa-user", () => {
      window.location.assign(getSiteProfileUrl());
    })
  );
  actions.appendChild(makeAction("My Purchases", "fa fa-key", () => window.location.assign(getSitePurchasesUrl())));
  actions.appendChild(makeAction("Account Settings", "fa fa-gear", () => window.location.assign(getSiteSettingsUrl())));

  const separator = document.createElement("div");
  separator.className = "supabaseMiniSeparator";

  const footer = document.createElement("div");
  footer.className = "supabaseMiniFooter";

  const signOutBtn = document.createElement("button");
  signOutBtn.type = "button";
  signOutBtn.className = "supabaseMiniSignOut";
  signOutBtn.appendChild(document.createTextNode("Sign Out"));
  const signOutIcon = document.createElement("i");
  signOutIcon.className = "fa-solid fa-arrow-right-from-bracket";
  signOutBtn.appendChild(signOutIcon);
  signOutBtn.addEventListener("click", async (e) => {
    e.preventDefault();
    try {
      if (supabase) await supabase.auth.signOut();
      setSignedOutUi();
      window.location.reload();
    } catch (err) {
      alert("Logout failed: " + (err?.message || err));
    }
  });
  footer.appendChild(signOutBtn);

  card.appendChild(header);
  card.appendChild(actions);
  card.appendChild(separator);
  card.appendChild(footer);
  menu.appendChild(card);
};

const bindMenuTriggers = () => {
  const links = [desktopSignIn, mobileSignIn].filter(Boolean);
  for (const link of links) {
    const href = link.getAttribute("href") || "";
    if (href.startsWith("http")) {
      link.setAttribute("href", "#");
      link.addEventListener(
        "click",
        (e) => {
          e.preventDefault();
        },
        true
      );
    }
  }
};

const signInWithGoogle = async () => {
  if (!canUseSupabase()) {
    alert("Supabase is not configured.");
    return;
  }
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: getRedirectTo() }
  });
  if (error) throw error;
};

const signInWithEmailPassword = async (form) => {
  const email = form.querySelector('input[name="auth"]')?.value?.trim();
  const password = form.querySelector('input[name="password"]')?.value || "";

  if (!email || !password) {
    alert("Please enter email and password.");
    return;
  }

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  if (data?.user) setSignedInUi(data.user);
};

const bindGlobalInterceptors = () => {
  if (document.documentElement.dataset.supabaseAuthGlobal === "1") return;
  document.documentElement.dataset.supabaseAuthGlobal = "1";

  document.addEventListener(
    "click",
    (e) => {
      const a = e.target?.closest?.("#elUserSignIn, #elSigninButton_mobile");
      if (!a) return;
      const href = a.getAttribute("href") || "";
      if (href.startsWith("http")) a.setAttribute("href", "#");
      e.preventDefault();
    },
    true
  );

  document.addEventListener(
    "click",
    async (e) => {
      const btn = e.target?.closest?.("button.ipsSocial_google");
      if (!btn) return;
      const form = btn.closest?.("form");
      if (!form) return;
      if (!form.querySelector?.('button[name="_processLogin"]')) return;
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      try {
        await signInWithGoogle();
      } catch (err) {
        alert(err?.message || "Google login failed");
      }
    },
    true
  );

  document.addEventListener(
    "submit",
    async (e) => {
      const form = e.target;
      if (!(form instanceof HTMLFormElement)) return;
      if (!form.querySelector('button[name="_processLogin"]')) return;
      if (!form.querySelector('input[name="auth"]')) return;
      if (!form.querySelector('input[name="password"]')) return;
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();

      if (!canUseSupabase()) {
        alert("Supabase is not configured.");
        return;
      }

      try {
        const submitter = e.submitter || document.activeElement;
        if (
          submitter &&
          (submitter.classList?.contains("ipsSocial_google") ||
            submitter.getAttribute?.("value") === "3" ||
            submitter.value === "3")
        ) {
          await signInWithGoogle();
          return;
        }

        await signInWithEmailPassword(form);
      } catch (err) {
        alert(err?.message || "Login failed");
      }
    },
    true
  );
};

const setSignedOutUi = () => {
  window.currentUser = null;
  if (desktopSignIn && originalDesktopSignInHtml !== null) desktopSignIn.innerHTML = originalDesktopSignInHtml;
  if (mobileSignIn && originalMobileSignInText !== null) mobileSignIn.textContent = originalMobileSignInText;
  if (signUpDesktop) signUpDesktop.style.display = "";
  if (signUpMobile) signUpMobile.style.display = "";
  if (menu && originalMenuHtml !== null) menu.innerHTML = originalMenuHtml;
  bindHeaderLogin();
};

const setSignedInUi = (user) => {
  window.currentUser = user;
  const userLabel = getUserLabel(user);
  const avatarUrl = getUserAvatarUrl(user);
  if (desktopSignIn) {
    if (avatarUrl) {
      desktopSignIn.innerHTML =
        '<img class="supabaseUserAvatar" alt="" src="' +
        avatarUrl +
        '"><span class="supabaseUserLabel">' +
        userLabel +
        '</span>  <i class="fa fa-caret-down"></i>';
    } else {
      desktopSignIn.innerHTML = '<span class="supabaseUserLabel">' + userLabel + '</span>  <i class="fa fa-caret-down"></i>';
    }
  }
  if (mobileSignIn) mobileSignIn.textContent = userLabel;
  if (signUpDesktop) signUpDesktop.style.display = "none";
  if (signUpMobile) signUpMobile.style.display = "none";
  buildSignedInMenu(user);
  ensureProfileRow(user);
};

const bindHeaderLogin = () => {
  const form = document.querySelector("#elUserSignIn_menu form");
  if (!form) return;
  if (form.dataset.supabaseBound === "1") return;
  form.dataset.supabaseBound = "1";

  if (form.getAttribute("action") && form.getAttribute("action") !== "#") {
    form.setAttribute("action", "#");
  }

  const bindGoogleButton = () => {
    const googleBtn = form.querySelector("button.ipsSocial_google");
    if (!googleBtn) return;
    if (googleBtn.dataset.supabaseGoogleBound === "1") return;
    googleBtn.dataset.supabaseGoogleBound = "1";

    googleBtn.addEventListener("click", async (e) => {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      if (!canUseSupabase()) {
        alert("Supabase is not configured.");
        return;
      }
      try {
        await signInWithGoogle();
      } catch (err) {
        alert(err?.message || "Google login failed");
      }
    });
  };

  bindGoogleButton();

  const observer = new MutationObserver(() => bindGoogleButton());
  observer.observe(form, { childList: true, subtree: true });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();

    if (!canUseSupabase()) {
      alert("Supabase is not configured.");
      return false;
    }

    try {
      const submitter = e.submitter || document.activeElement;
      if (
        submitter &&
        (submitter.classList?.contains("ipsSocial_google") ||
          submitter.getAttribute?.("value") === "3" ||
          submitter.value === "3")
      ) {
        await signInWithGoogle();
        return false;
      }
      await signInWithEmailPassword(form);
      return false;
    } catch (err) {
      alert(err?.message || "Login failed");
      return false;
    }
  });
};

const initAuthUi = async () => {
  if (!canUseSupabase()) {
    setSignedOutUi();
    return;
  }

  const currentSession = await supabase.auth.getSession();
  const session = currentSession?.data?.session || null;
  if (session?.user) setSignedInUi(session.user);
  else setSignedOutUi();

  supabase.auth.onAuthStateChange((_event, newSession) => {
    if (newSession?.user) setSignedInUi(newSession.user);
    else setSignedOutUi();
  });
};

const initNotice = () => {
  const url = new URL(window.location.href);
  const notice = url.searchParams.get("notice");
  if (!notice) return;
  alert(notice);
  url.searchParams.delete("notice");
  window.history.replaceState({}, document.title, url.pathname + (url.search ? url.search : "") + url.hash);
};

if (desktopSignIn || mobileSignIn || menu) {
  ensureMiniCardStyles();
  bindGlobalInterceptors();
  bindMenuTriggers();
  bindHeaderLogin();
  initNotice();
  Promise.resolve(initAuthUi()).catch(() => {
    setSignedOutUi();
  });
}

window.__supabaseAuth = {
  supabase,
  canUseSupabase,
  setSignedInUi,
  setSignedOutUi
};

window.kyloSupabase = supabase;
window.kyloCanUseSupabase = canUseSupabase;
