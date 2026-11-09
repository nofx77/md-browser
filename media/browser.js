// @ts-check
(function () {
  // @ts-ignore
  const vscode = acquireVsCodeApi();
  // @ts-ignore
  const state = window.__MDB_STATE__ || {};

  const $ = (id) => /** @type {HTMLElement} */ (document.getElementById(id));
  const backBtn = /** @type {HTMLButtonElement} */ ($('mdb-back'));
  const fwdBtn = /** @type {HTMLButtonElement} */ ($('mdb-forward'));
  const historySel = /** @type {HTMLSelectElement} */ ($('mdb-history'));

  function setNavState(s) {
    backBtn.disabled = !s.canBack;
    fwdBtn.disabled = !s.canForward;
    historySel.innerHTML = '';
    const placeholder = document.createElement('option');
    placeholder.textContent = s.history && s.history.length ? `Historique (${s.history.length})` : 'Historique vide';
    placeholder.value = '';
    historySel.appendChild(placeholder);
    (s.history || [])
      .slice()
      .reverse()
      .forEach((h) => {
        const o = document.createElement('option');
        o.value = String(h.index);
        o.textContent = h.label;
        historySel.appendChild(o);
      });
    historySel.disabled = !(s.history && s.history.length);
  }

  // ---------- Ancres ----------
  function slugify(text) {
    return text
      .trim()
      .toLowerCase()
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^\p{L}\p{N}\s_-]/gu, '')
      .replace(/\s+/g, '-');
  }

  // Assure que chaque titre a un id (au cas où le moteur de rendu n'en aurait pas mis)
  document.querySelectorAll('.mdb-content h1, .mdb-content h2, .mdb-content h3, .mdb-content h4, .mdb-content h5, .mdb-content h6').forEach((h) => {
    if (!h.id) {
      h.id = slugify(h.textContent || '');
    }
  });

  function findAnchor(fragment) {
    if (!fragment) return null;
    const candidates = [fragment, fragment.toLowerCase(), slugify(fragment)];
    try {
      candidates.push(decodeURIComponent(fragment));
    } catch (_) {}
    for (const c of candidates) {
      const el = document.getElementById(c) || document.querySelector(`[name="${CSS.escape(c)}"]`);
      if (el) return el;
    }
    // Comparaison sans accents (ex. #presentation vs id="présentation")
    const target = slugify(fragment).normalize('NFD').replace(/[̀-ͯ]/g, '');
    for (const el of document.querySelectorAll('[id]')) {
      if (el.id.normalize('NFD').replace(/[̀-ͯ]/g, '') === target) return el;
    }
    return null;
  }

  function scrollToFragment(fragment) {
    const el = findAnchor(fragment);
    if (el) {
      el.scrollIntoView({ block: 'start' });
      el.classList.add('mdb-flash');
      setTimeout(() => el.classList.remove('mdb-flash'), 1200);
    }
  }

  // ---------- Liens ----------
  document.addEventListener('click', (e) => {
    const a = /** @type {HTMLElement} */ (e.target).closest('a');
    if (!a) return;
    const href = a.getAttribute('data-href') || a.getAttribute('href');
    if (!href) return;
    e.preventDefault();
    e.stopPropagation();
    vscode.postMessage({ type: 'link', href });
  }, true);

  // Boutons précédent / suivant de la souris
  document.addEventListener('mouseup', (e) => {
    if (e.button === 3) {
      e.preventDefault();
      vscode.postMessage({ type: 'back' });
    } else if (e.button === 4) {
      e.preventDefault();
      vscode.postMessage({ type: 'forward' });
    }
  });

  // ---------- Barre d'outils ----------
  backBtn.addEventListener('click', () => vscode.postMessage({ type: 'back' }));
  fwdBtn.addEventListener('click', () => vscode.postMessage({ type: 'forward' }));
  $('mdb-home').addEventListener('click', () => vscode.postMessage({ type: 'home' }));
  $('mdb-reload').addEventListener('click', () => vscode.postMessage({ type: 'reload' }));
  $('mdb-edit').addEventListener('click', () => vscode.postMessage({ type: 'edit' }));
  historySel.addEventListener('change', () => {
    if (historySel.value !== '') {
      vscode.postMessage({ type: 'history', index: Number(historySel.value) });
    }
  });

  // ---------- Position de défilement (pour la restaurer au retour) ----------
  let scrollTimer;
  window.addEventListener('scroll', () => {
    clearTimeout(scrollTimer);
    scrollTimer = setTimeout(() => vscode.postMessage({ type: 'scroll', scrollY: window.scrollY }), 150);
  });

  // ---------- Messages de l'extension ----------
  window.addEventListener('message', (event) => {
    const msg = event.data;
    if (msg.type === 'scrollToFragment') scrollToFragment(msg.fragment);
    if (msg.type === 'navState') setNavState(msg);
  });

  // ---------- Initialisation ----------
  setNavState(state);
  const restore = () => {
    if (state.scrollY > 0) {
      window.scrollTo(0, state.scrollY);
    } else if (state.fragment) {
      scrollToFragment(state.fragment);
    }
  };
  if (document.readyState === 'complete') restore();
  else window.addEventListener('load', restore);
})();
