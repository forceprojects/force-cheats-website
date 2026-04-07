(function () {
  const isHidden = (el) => el.classList.contains('ipsHide');
  const show = (el) => el.classList.remove('ipsHide');
  const hide = (el) => el.classList.add('ipsHide');

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
        if (isHidden(drawer)) show(drawer);
        else hide(drawer);
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
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind);
  else bind();
})();
