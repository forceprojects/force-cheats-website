const FALLBACK_SUPABASE_URL = "https://tjpxmbfekgnxtyujvyvx.supabase.co";
const FALLBACK_SUPABASE_ANON_KEY = "sb_publishable_MY0T9tn8TU567ZRsnoZHyA_gGqyVs2W";

const ensureSupabase = () => {
  const existing = window.kyloSupabase;
  if (existing && existing.auth) return existing;
  const url = String(window.kyloSupabaseUrl || FALLBACK_SUPABASE_URL);
  const key = String(window.kyloSupabaseAnonKey || FALLBACK_SUPABASE_ANON_KEY);
  if (!url || !key) return null;
  const createClient = window.supabase?.createClient;
  if (typeof createClient !== "function") return null;
  const sb = createClient(url, key, { auth: { persistSession: true, storage: window.localStorage } });
  window.kyloSupabase = sb;
  window.kyloSupabaseUrl = url;
  window.kyloSupabaseAnonKey = key;
  return sb;
};

const escapeHtml = (value) =>
  String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

const formatDayMonthYear = (iso) => {
  const d = new Date(iso || "");
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
};

const initials = (name) => {
  const s = String(name || "").trim();
  if (!s) return "A";
  const parts = s.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase();
  return (parts[0].slice(0, 1) + parts[parts.length - 1].slice(0, 1)).toUpperCase();
};

const profileHref = (username) => {
  const u = String(username || "").trim();
  if (!u) return "#";
  return "profile.html?user=" + encodeURIComponent(u);
};

const ADMIN_EMAIL = "surgeworldorder@protonmail.com";
const ADMIN_USERNAME = "admin";

const isAdminUser = (user) => {
  const email = String(user?.email || "").toLowerCase();
  if (email && email === ADMIN_EMAIL) return true;
  const metaUsername = String(user?.user_metadata?.username || user?.user_metadata?.user_name || "").trim().toLowerCase();
  if (metaUsername && metaUsername === ADMIN_USERNAME) return true;
  return false;
};

const getTeamMe = async (supabase) => {
  if (!supabase || !supabase.auth || typeof supabase.auth.getSession !== "function") return null;
  try {
    const { data } = await supabase.auth.getSession();
    const token = String(data?.session?.access_token || "");
    if (!token) return null;
    const res = await fetch("/api/team/me", { headers: { Authorization: "Bearer " + token } });
    const json = await res.json().catch(() => null);
    if (!res.ok || !json || !json.ok) return null;
    return { isAdmin: Boolean(json.isAdmin), isSuperAdmin: Boolean(json.isSuperAdmin), permissions: json.permissions || {} };
  } catch (_) {
    return null;
  }
};

const isMissingFunctionError = (error) => {
  const code = String(error?.code || "");
  const msg = String(error?.message || "").toLowerCase();
  return code === "42883" || (msg.includes("function") && msg.includes("does not exist"));
};

const isMissingTableError = (error, table) => {
  const code = String(error?.code || "");
  const msg = String(error?.message || "");
  const t = String(table || "");
  return code === "PGRST205" || (msg.includes("Could not find the table") && (t ? msg.includes(t) : true));
};

const ensureTopActions = () => {
  let wrap = document.getElementById("kyloReviewsTopActions");
  if (wrap) return wrap;
  wrap = document.createElement("div");
  wrap.id = "kyloReviewsTopActions";
  wrap.style.display = "flex";
  wrap.style.flexWrap = "wrap";
  wrap.style.gap = "12px";
  wrap.style.alignItems = "center";
  wrap.style.justifyContent = "space-between";
  wrap.style.margin = "24px 0 0";
  const list = document.querySelector("ul.rwp-list");
  if (list) list.insertAdjacentElement("beforebegin", wrap);
  return wrap;
};

const buildButton = (label) => {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "ipsButton ipsButton_primary ipsButton_small";
  btn.textContent = label;
  return btn;
};

const ensureInlineDialog = (id, html) => {
  let el = document.getElementById(id);
  if (!el) {
    el = document.createElement("div");
    el.id = id;
    el.className = "ipsHide";
    document.body.appendChild(el);
  }
  el.innerHTML = html;
  return el;
};

const openInlineDialog = ({ id, title, html, onReady, size }) => {
  const content = ensureInlineDialog(id, html);
  if (window.ips?.ui?.dialog?.create) {
    const dialogRef = window.ips.ui.dialog.create({
      content: "#" + id,
      title: String(title || ""),
      size: String(size || "narrow")
    });
    dialogRef.show();
    onReady?.(content, () => dialogRef.hide());
    return;
  }

  const ensureLocalOverlay = () => {
    const overlayId = "kyloLocalDialogOverlay";
    const panelId = "kyloLocalDialogPanel";
    let overlay = document.getElementById(overlayId);
    if (!overlay) {
      overlay = document.createElement("div");
      overlay.id = overlayId;
      overlay.className = "ipsHide";
      overlay.innerHTML = '<div id="' + panelId + '" role="dialog" aria-modal="true"></div>';
      document.body.appendChild(overlay);

      const styleId = "kyloLocalDialogOverlayStyles";
      if (!document.getElementById(styleId)) {
        const style = document.createElement("style");
        style.id = styleId;
        style.textContent =
          "#" +
          overlayId +
          "{position:fixed;inset:0;z-index:1000000;background:rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center;padding:24px}" +
          "#" +
          overlayId +
          ".ipsHide{display:none}" +
          "#" +
          panelId +
          "{width:min(560px,calc(100vw - 24px));max-height:min(80vh,560px);overflow:auto;background:#0f111a;border:1px solid rgba(255,255,255,.10);border-radius:14px;box-shadow:0 24px 60px rgba(0,0,0,.55)}" +
          "#" +
          panelId +
          " .kyloLocalDialogHeader{display:flex;align-items:center;justify-content:space-between;padding:14px 16px;border-bottom:1px solid rgba(255,255,255,.08)}" +
          "#" +
          panelId +
          " .kyloLocalDialogTitle{font-weight:800}" +
          "#" +
          panelId +
          " .kyloLocalDialogClose{background:transparent;border:0;color:rgba(255,255,255,.8);font-size:20px;line-height:1;cursor:pointer;padding:6px 10px;border-radius:10px}" +
          "#" +
          panelId +
          " .kyloLocalDialogClose:hover{background:rgba(255,255,255,.06)}" +
          "#" +
          panelId +
          " .kyloLocalDialogBody{padding:0}";
        document.head.appendChild(style);
      }

      overlay.addEventListener("click", (e) => {
        if (e.target === overlay) overlay.classList.add("ipsHide");
      });
      document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") overlay.classList.add("ipsHide");
      });
    }
    return { overlay, panel: overlay.querySelector("#" + panelId) };
  };

  const { overlay, panel } = ensureLocalOverlay();
  const headline =
    '<div class="kyloLocalDialogHeader"><div class="kyloLocalDialogTitle">' +
    String(title || "") +
    '</div><button type="button" class="kyloLocalDialogClose" aria-label="Close">×</button></div>';
  panel.innerHTML = headline + '<div class="kyloLocalDialogBody">' + html + "</div>";
  overlay.classList.remove("ipsHide");

  const close = () => overlay.classList.add("ipsHide");
  panel.querySelector(".kyloLocalDialogClose")?.addEventListener("click", close);
  onReady?.(panel, close);
};

const openMiniPrompt = ({ title, placeholder, confirmText, confirmMessage, inputType, onConfirm }) => {
  const safePlaceholder = String(placeholder || "").replace(/"/g, "&quot;");
  const safeConfirmText = String(confirmText || "Confirm");
  const safeInputType = String(inputType || "text");
  openInlineDialog({
    id: "kyloMiniPromptDialog",
    title: String(title || "Action"),
    html:
      '<div class="ipsPad ipsForm ipsForm_vertical">' +
      '<ul class="ipsList_reset">' +
      '<li class="ipsFieldRow ipsFieldRow_noLabel ipsFieldRow_fullWidth">' +
      '<input type="' +
      safeInputType +
      '" id="kyloMiniPromptInput" class="ipsField_fullWidth" placeholder="' +
      safePlaceholder +
      '">' +
      "</li>" +
      '<li class="ipsFieldRow ipsFieldRow_fullWidth">' +
      '<button type="button" id="kyloMiniPromptOk" class="ipsButton ipsButton_primary ipsButton_small">' +
      safeConfirmText +
      "</button>" +
      "</li>" +
      "</ul>" +
      "</div>",
    onReady: (content, close) => {
      const input = content.querySelector("#kyloMiniPromptInput");
      const okBtn = content.querySelector("#kyloMiniPromptOk");
      if (!input || !okBtn) return;

      const runConfirm = async () => {
        const value = String(input.value || "").trim();
        if (!value) return;
        if (confirmMessage) {
          const yes = window.confirm(String(confirmMessage));
          if (!yes) return;
        }
        okBtn.disabled = true;
        try {
          await onConfirm?.(value);
          close();
        } catch (err) {
          okBtn.disabled = false;
          alert(err?.message || String(err));
        }
      };

      okBtn.addEventListener("click", runConfirm);
      input.addEventListener("keydown", (e) => {
        if (e.key === "Enter") runConfirm();
      });
      setTimeout(() => input.focus(), 0);
    },
    size: "narrow"
  });
};

const isDuplicateRowError = (error) => {
  const code = String(error?.code || "");
  const msg = String(error?.message || "").toLowerCase();
  return code === "23505" || msg.includes("duplicate key value") || msg.includes("unique");
};

const SITE_REVIEW_PRODUCT_KEY = "site";

const openLeaveReviewDialog = ({ supabase, user, profile }) =>
  new Promise((resolve) => {
    const ratingOptions = [5, 4, 3, 2, 1]
      .map((n) => '<option value="' + String(n) + '"' + (n === 5 ? " selected" : "") + ">" + String(n) + "</option>")
      .join("");

    openInlineDialog({
      id: "kyloLeaveReviewDialog",
      title: "Leave a Review",
      size: "medium",
      html:
        '<div class="ipsPad ipsForm ipsForm_vertical">' +
        '<div class="ipsType_reset ipsType_light ipsSpacer_bottom">One review per user.</div>' +
        '<ul class="ipsList_reset">' +
        '<li class="ipsFieldRow ipsFieldRow_noLabel ipsFieldRow_fullWidth">' +
        '<select id="kyloReviewRating" class="ipsField_fullWidth">' +
        ratingOptions +
        "</select>" +
        "</li>" +
        '<li class="ipsFieldRow ipsFieldRow_noLabel ipsFieldRow_fullWidth">' +
        '<textarea id="kyloReviewContent" class="ipsField_fullWidth" rows="5" placeholder="Write your review..."></textarea>' +
        "</li>" +
        '<li class="ipsFieldRow ipsFieldRow_fullWidth">' +
        '<button type="button" id="kyloReviewSubmit" class="ipsButton ipsButton_primary ipsButton_small">Submit review</button>' +
        "</li>" +
        "</ul>" +
        "</div>",
      onReady: (content, close) => {
        const ratingSelect = content.querySelector("#kyloReviewRating");
        const contentInput = content.querySelector("#kyloReviewContent");
        const submitBtn = content.querySelector("#kyloReviewSubmit");
        if (!ratingSelect || !contentInput || !submitBtn) return;

        const run = async () => {
          const productKey = SITE_REVIEW_PRODUCT_KEY;
          const productName = "";
          const rating = Math.max(1, Math.min(5, Number(ratingSelect.value) || 0));
          const text = String(contentInput.value || "").trim();

          if (!rating) {
            alert("Rating is required.");
            return;
          }
          if (text.length < 3) {
            alert("Review is too short.");
            return;
          }

          submitBtn.disabled = true;
          try {
            const { data: existing, error: checkErr } = await supabase
              .from("product_reviews")
              .select("id")
              .eq("user_id", user.id)
              .eq("product_key", productKey)
              .maybeSingle();
            if (checkErr) {
              if (isMissingTableError(checkErr, "product_reviews")) {
                alert('Missing table "product_reviews".\n\nRun supabase/product_reviews.sql in Supabase SQL Editor (and make sure RLS is enabled).');
                submitBtn.disabled = false;
                return;
              }
            }
            if (existing?.id) {
              alert("You already submitted a review.");
              submitBtn.disabled = false;
              return;
            }

            const payload = {
              product_key: productKey,
              product_name: productName || null,
              user_id: user.id,
              username:
                String(profile?.username || "").trim() ||
                String(user?.user_metadata?.username || user?.email?.split("@")?.[0] || "").trim() ||
                null,
              display_name: String(profile?.display_name || "").trim() || String(user?.user_metadata?.full_name || "").trim() || null,
              rating,
              content: text
            };

            const { error: insertErr } = await supabase.from("product_reviews").insert(payload);
            if (insertErr) {
              if (isMissingTableError(insertErr, "product_reviews")) {
                alert('Missing table "product_reviews".\n\nRun supabase/product_reviews.sql in Supabase SQL Editor (and make sure RLS is enabled).');
                submitBtn.disabled = false;
                return;
              }
              if (isDuplicateRowError(insertErr)) {
                alert("You already submitted a review.");
                submitBtn.disabled = false;
                return;
              }
              alert(String(insertErr?.message || "Failed to submit review."));
              submitBtn.disabled = false;
              return;
            }

            alert("Review submitted.");
            close();
            resolve(true);
            window.location.reload();
          } catch (err) {
            submitBtn.disabled = false;
            alert(String(err?.message || "Failed to submit review."));
          }
        };

        submitBtn.addEventListener("click", run);
        contentInput.addEventListener("keydown", (e) => {
          if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) run();
        });
        setTimeout(() => ratingSelect.focus(), 0);
      }
    });
  });

const deleteReview = async (supabase, reviewId, table) => {
  const id = String(reviewId || "").trim();
  if (!id) return { ok: false, reason: "invalid-id" };
  const t = String(table || "").trim();
  try {
    const fn = t === "order_reviews" ? "delete_order_review" : "delete_product_review";
    const rpc = await supabase.rpc(fn, { review_id: id });
    if (rpc?.error) {
      const code = String(rpc.error?.code || "");
      const msg = String(rpc.error?.message || "").toLowerCase();
      if (code === "42883" || msg.includes("function") && msg.includes("does not exist")) {
        return { ok: false, reason: "missing-rpc", error: rpc.error };
      }
    } else {
      if (rpc.data === true) return { ok: true, method: "rpc" };
      if (rpc.data === false) return { ok: false, reason: "not-allowed" };
    }
  } catch (_) {}

  try {
    const { error: delError } = await supabase.from(t || "product_reviews").delete().eq("id", id);
    if (delError) return { ok: false, reason: "delete-error", error: delError };

    const { data: stillThere, error: checkError } = await supabase
      .from(t || "product_reviews")
      .select("id")
      .eq("id", id)
      .maybeSingle();
    if (!checkError && stillThere) return { ok: false, reason: "not-deleted" };

    return { ok: true, method: "direct" };
  } catch (err) {
    return { ok: false, reason: "exception", error: err };
  }
};

const main = async () => {
  const list = document.querySelector("ul.rwp-list");
  if (!list) return;
  const supabase = ensureSupabase();
  if (!supabase) return;

  let currentUser = null;
  try {
    const { data } = await supabase.auth.getUser();
    currentUser = data?.user || null;
  } catch (_) {}

  const localAdmin = Boolean(currentUser && isAdminUser(currentUser));
  const teamMe = currentUser ? await getTeamMe(supabase) : null;
  const perms = teamMe && teamMe.permissions && typeof teamMe.permissions === "object" ? teamMe.permissions : {};
  const admin = Boolean(localAdmin || teamMe?.isAdmin);
  const canDeleteReviews = Boolean(localAdmin || perms.forums_manage);
  const canManualAddUser = Boolean(localAdmin || perms.customer_manual);

  const topActions = ensureTopActions();
  if (topActions) {
    topActions.replaceChildren();
  }

  let currentProfile = null;
  if (currentUser?.id) {
    try {
      const { data: p } = await supabase
        .from("profiles")
        .select("id,username,display_name,avatar_url,role,reputation,email")
        .eq("id", currentUser.id)
        .maybeSingle();
      if (p) currentProfile = p;
    } catch (_) {}
  }

  if (canManualAddUser && topActions) {
    const btn = buildButton("Add User");
    btn.classList.add("ipsButton_light");
    btn.addEventListener("click", async () => {
      openMiniPrompt({
        title: "Add User",
        placeholder: "User email",
        confirmText: "Add",
        confirmMessage: "Add this user as Customer (Reputation 2)?",
        inputType: "email",
        onConfirm: async (emailRaw) => {
          const email = String(emailRaw || "").trim().toLowerCase();
          if (!email) return;
          const { data, error } = await supabase.rpc("grant_customer_role_by_email", { target_email: email });
          if (error) {
            if (isMissingFunctionError(error)) {
              alert('Missing function "grant_customer_role_by_email".\n\nRun supabase/profiles_email_reputation.sql in Supabase SQL Editor.');
              return;
            }
            alert(String(error?.message || "Failed."));
            return;
          }
          if (data === true) alert("User added (Customer, Reputation 2).");
          else alert("No profile found for that email.");
        }
      });
    });
    topActions.appendChild(btn);
  }

  const canLeave =
    Boolean(currentUser?.id) &&
    !admin &&
    String(currentProfile?.role || "").trim().toLowerCase() === "customer" &&
    (Number(currentProfile?.reputation ?? 0) || 0) >= 2;

  if (canLeave && topActions) {
    const btn = buildButton("Leave a review");
    btn.addEventListener("click", async () => {
      btn.disabled = true;
      try {
        await openLeaveReviewDialog({ supabase, user: currentUser, profile: currentProfile });
      } finally {
        btn.disabled = false;
      }
    });
    topActions.appendChild(btn);
  }

  let data = null;
  let error = null;
  let sourceTable = "product_reviews";
  try {
    const res = await supabase
      .from("order_reviews")
      .select("id,order_id,user_id,username,display_name,rating,content,created_at")
      .order("created_at", { ascending: false })
      .limit(50);
    data = res.data;
    error = res.error;
    sourceTable = "order_reviews";
  } catch (e) {
    error = e;
  }

  if (error || !Array.isArray(data) || !data.length) {
    data = null;
    error = null;
    sourceTable = "product_reviews";
    try {
      const res = await supabase
        .from("product_reviews")
        .select("id,product_key,product_name,user_id,username,display_name,rating,content,created_at")
        .order("created_at", { ascending: false })
        .limit(50);
      data = res.data;
      error = res.error;
    } catch (e) {
      error = e;
    }
  }

  if (error || !Array.isArray(data) || !data.length) return;

  const userIds = Array.from(
    new Set(
      data
        .map((r) => String(r?.user_id || "").trim())
        .filter(Boolean),
    ),
  ).slice(0, 200);
  const profilesById = new Map();
  if (userIds.length) {
    try {
      const { data: profiles, error: profilesErr } = await supabase
        .from("profiles")
        .select("id,username,display_name,avatar_url")
        .in("id", userIds)
        .limit(200);
      if (!profilesErr && Array.isArray(profiles)) {
        profiles.forEach((p) => {
          const id = String(p?.id || "").trim();
          if (!id) return;
          profilesById.set(id, p);
        });
      }
    } catch (_) {}
  }

  const existingIds = new Set(Array.from(list.querySelectorAll("li[data-review-id]")).map((li) => li.getAttribute("data-review-id")).filter(Boolean));
  const fr = document.createDocumentFragment();

  data
    .filter((r) => !existingIds.has(String(r?.id || "")))
    .forEach((r) => {
      const rating = Math.max(1, Math.min(5, Number(r?.rating) || 5));
      const text = String(r?.content || "").trim();
      const userId = String(r?.user_id || "").trim();
      const p = userId ? profilesById.get(userId) || null : null;
      const name = String(p?.display_name || r?.display_name || p?.username || r?.username || "User").trim();
      const username = String(p?.username || r?.username || "").trim();
      const avatarUrl = String(p?.avatar_url || "").trim();
      const date = formatDayMonthYear(r?.created_at);
      const reviewId = String(r?.id || "").trim();

      const li = document.createElement("li");
      li.className = "swiper-slide theme-review-box";
      li.setAttribute("data-review-id", reviewId);
      li.innerHTML = `
        <p class="theme-review--text">${escapeHtml(text)}</p>
        <div class="theme-reviews_footer">
          <div class="review-avatar">${
            avatarUrl
              ? `<img src="${escapeHtml(avatarUrl)}" alt="${escapeHtml(name)}" referrerpolicy="no-referrer" loading="lazy" style="width:100%;height:100%;border-radius:10px;object-fit:cover;display:block;">`
              : escapeHtml(initials(name))
          }</div>
          <div class="review-content">
            <a class="name" href="${escapeHtml(profileHref(username))}">${escapeHtml(name)}</a>
            <span class="date">${escapeHtml(date)}</span>
          </div>
          ${
            canDeleteReviews
              ? `<button type="button" class="review-adminDeleteSquare" aria-label="Delete review" data-action="deleteReview" data-review-id="${escapeHtml(reviewId)}"><i class="fa-solid fa-trash"></i></button>`
              : ""
          }
          <div class="review-count">${escapeHtml(String(rating))} <i class="fa-solid fa-star"></i></div>
        </div>
      `.trim();
      fr.appendChild(li);
    });

  if (fr.childNodes.length) list.insertBefore(fr, list.firstChild);

  if (admin && list.dataset.adminDeleteBound !== "1") {
    list.dataset.adminDeleteBound = "1";
    list.addEventListener("click", async (e) => {
      const btn = e.target instanceof Element ? e.target.closest('[data-action="deleteReview"][data-review-id]') : null;
      if (!btn) return;
      e.preventDefault();
      const id = String(btn.getAttribute("data-review-id") || "").trim();
      if (!id) return;
      const yes = window.confirm("Delete this review?");
      if (!yes) return;
      try {
        const res = await deleteReview(supabase, id, sourceTable);
        if (!res.ok) {
          if (res.reason === "missing-rpc") {
            alert(
              sourceTable === "order_reviews"
                ? 'Delete is blocked by database rules.\n\nUruchom supabase/order_reviews_delete.sql w Supabase -> SQL Editor (i upewnij się, że RLS dla order_reviews jest włączony).'
                : 'Delete is blocked by database rules.\n\nUruchom supabase/product_reviews_delete.sql w Supabase -> SQL Editor (i upewnij się, że RLS dla product_reviews jest włączony).'
            );
            return;
          }
          if (res.reason === "not-allowed") {
            alert("Nie masz uprawnień do usunięcia tej opinii.");
            return;
          }
          if (res.reason === "not-deleted") {
            alert("Nie udało się usunąć opinii (blokada po stronie bazy danych).");
            return;
          }
          throw res.error || new Error("Failed to delete review.");
        }
        const li = btn.closest("li[data-review-id]");
        if (li) li.remove();
      } catch (err) {
        alert(String(err?.message || "Failed to delete review."));
      }
    });
  }
};

main();
