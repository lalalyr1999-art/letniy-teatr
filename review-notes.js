/* review-notes.js — режим «замечаний заказчика». Без зависимостей.
   Подключение: <script src="/review-notes.js" defer></script> перед </body>. */
(function () {
  'use strict';

  const CONFIG = {
    ENABLED: true,                 // false — функция полностью отключена
    SUPABASE_URL: 'https://eeiizaipwgcckznqiopb.supabase.co',
    SUPABASE_ANON_KEY: 'sb_publishable_v78G0PxFEyhI99OpMH2GeA_9gdheLik',
    SITE_ID: 'letniy-teatr',   // уникальный id сайта латиницей
    POLL_INTERVAL_MS: 20000
  };

  if (!CONFIG.ENABLED) return;
  if (window.__reviewNotes) return;
  if (/XXXX/.test(CONFIG.SUPABASE_URL + CONFIG.SUPABASE_ANON_KEY)) {
    console.warn('[review-notes] не заполнены SUPABASE_URL / SUPABASE_ANON_KEY — замечания выключены');
    return;
  }

  const NS = window.__reviewNotes = { version: 1 };
  const API = CONFIG.SUPABASE_URL.replace(/\/+$/, '') + '/rest/v1/review_notes';
  const PAGE = location.pathname;
  const COLORS = { desktop: '#E5322D', mobile: '#F5C400' };
  const MAXLEN = 2000;
  const EXCLUDE = 'a,button,input,textarea,select,option,label,summary,[contenteditable]:not([contenteditable="false"]),' +
    '[role=button],[role=link],[role=menuitem],img,picture,video,audio,iframe,canvas,[data-no-review]';
  const FIELDS = 'input,textarea,select,option,[contenteditable]:not([contenteditable="false"])';
  const ERR = 'Не сохранилось, попробуйте ещё раз';

  const notes = new Map();       // id -> row
  let host, root, layer, panel = null, tempDot = null;
  let lastOpenAt = 0, lastSrc = '', lastSrcAt = 0, mutationSeq = 0, rafPending = false;

  const log = (...a) => console.warn('[review-notes]', ...a);
  const defaultDevice = () =>
    (matchMedia('(pointer: coarse)').matches && Math.min(screen.width, innerWidth) <= 820) ? 'mobile' : 'desktop';

  /* ---------- сеть ---------- */
  async function api(method, query, body, prefer) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 12000);
    try {
      const headers = { apikey: CONFIG.SUPABASE_ANON_KEY };
      // старый anon-ключ (JWT) нужен ещё и в Authorization; новый sb_publishable_ — только в apikey
      if (/^eyJ/.test(CONFIG.SUPABASE_ANON_KEY)) headers.Authorization = 'Bearer ' + CONFIG.SUPABASE_ANON_KEY;
      if (body) headers['Content-Type'] = 'application/json';
      if (prefer) headers.Prefer = prefer;
      const r = await fetch(API + '?' + query, {
        method, headers, signal: ctrl.signal, cache: 'no-store',
        body: body ? JSON.stringify(body) : undefined
      });
      if (!r.ok) throw new Error(method + ' ' + r.status + ' ' + (await r.text()).slice(0, 200));
      const txt = await r.text();
      return txt ? JSON.parse(txt) : null;
    } finally { clearTimeout(t); }
  }
  const eq = v => 'eq.' + encodeURIComponent(v);
  const byId = id => 'id=' + eq(id);

  async function loadAll() {
    const seq = mutationSeq;
    try {
      const rows = await api('GET', 'select=*&site_id=' + eq(CONFIG.SITE_ID) + '&page=' + eq(PAGE) + '&order=created_at.asc');
      if (seq !== mutationSeq || !Array.isArray(rows)) return; // пока грузили, что-то поменяли — дождёмся следующего опроса
      notes.clear();
      rows.forEach(r => notes.set(r.id, r));
      if (panel && panel.noteId && !notes.has(panel.noteId)) closePanel();
      renderDots();
    } catch (e) { log('загрузка', e); }
  }

  /* ---------- стиль сайта ---------- */
  const isTransparent = c => !c || c === 'transparent' || /rgba\([^)]*,\s*0\)$/.test(c);
  function visible(el) {
    if (!el.getClientRects().length) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  }
  function luminance(c) {
    const m = (c || '').match(/[\d.]+/g);
    if (!m || m.length < 3) return 1;
    const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    return 0.2126 * f(+m[0]) + 0.7152 * f(+m[1]) + 0.0722 * f(+m[2]);
  }
  function detectStyle() {
    const body = document.body, bs = getComputedStyle(body);
    let minSize = Infinity, minWeight = Infinity, n = 0;
    const walker = document.createTreeWalker(body, NodeFilter.SHOW_TEXT);
    const seen = new Set();
    while (walker.nextNode() && n < 4000) {
      const t = walker.currentNode;
      if (!t.nodeValue.trim()) continue;
      const el = t.parentElement;
      if (!el || seen.has(el) || el === host || /^(SCRIPT|STYLE|NOSCRIPT|TEMPLATE)$/.test(el.tagName)) continue;
      seen.add(el); n++;
      if (!visible(el)) continue;
      const cs = getComputedStyle(el);
      if (cs.visibility === 'hidden' || +cs.opacity === 0) continue;
      const fs = parseFloat(cs.fontSize), fw = parseInt(cs.fontWeight, 10);
      if (fs > 0) minSize = Math.min(minSize, fs);
      if (fw > 0) minWeight = Math.min(minWeight, fw);
    }
    if (!isFinite(minSize)) minSize = parseFloat(bs.fontSize) || 14;
    if (!isFinite(minWeight)) minWeight = 400;

    let bg = null;
    for (const el of [body, document.documentElement, document.querySelector('main')]) {
      if (el && !isTransparent(getComputedStyle(el).backgroundColor)) { bg = getComputedStyle(el).backgroundColor; break; }
    }
    if (!bg) {
      const el = document.elementFromPoint(innerWidth / 2, innerHeight / 2);
      for (let p = el; p; p = p.parentElement) {
        const c = getComputedStyle(p).backgroundColor;
        if (!isTransparent(c)) { bg = c; break; }
      }
    }
    bg = bg || '#ffffff';
    const color = bs.color || '#111111';

    const btns = [...document.querySelectorAll('button,[class*="btn"],[class*="button"],[role=button]')]
      .filter(b => b !== host && visible(b)).slice(0, 60);
    const sat = c => { const m = (c || '').match(/[\d.]+/g); if (!m) return 0; const v = m.slice(0, 3).map(Number), mx = Math.max(...v), mn = Math.min(...v); return mx ? (mx - mn) / mx : 0; };
    let btn = btns[0], best = 0.25;
    btns.forEach(b => { const c = getComputedStyle(b).backgroundColor; if (!isTransparent(c) && sat(c) > best) { best = sat(c); btn = b; } });
    const radius = btn ? parseFloat(getComputedStyle(btn).borderTopLeftRadius) || 0 : 0;

    let accent = null;
    if (btn) {
      const c = getComputedStyle(btn).backgroundColor;
      if (!isTransparent(c) && Math.abs(luminance(c) - luminance(bg)) > 0.08) accent = c;
    }
    if (!accent) {
      const a = [...document.querySelectorAll('a[href]')].find(visible);
      const c = a && getComputedStyle(a).color;
      if (c && Math.abs(luminance(c) - luminance(bg)) > 0.08) accent = c;
    }
    accent = accent || color;

    const s = host.style;
    s.setProperty('--rn-font', bs.fontFamily || 'system-ui, sans-serif');
    s.setProperty('--rn-size', Math.max(11, Math.round(minSize)) + 'px');
    s.setProperty('--rn-weight', String(minWeight));
    s.setProperty('--rn-fg', color);
    s.setProperty('--rn-bg', bg);
    s.setProperty('--rn-radius', Math.min(radius, 999) + 'px');
    s.setProperty('--rn-panel-radius', Math.min(radius, 14) + 'px');
    s.setProperty('--rn-accent', accent);
    s.setProperty('--rn-on-accent', luminance(accent) > 0.45 ? '#111' : '#fff');
  }

  /* ---------- привязка ---------- */
  function cssPath(el) {
    if (!el || el === document.body || el === document.documentElement) return 'body';
    const parts = [];
    for (let e = el; e && e !== document.body && e !== document.documentElement; e = e.parentElement) {
      if (e.id) {
        const sel = '#' + CSS.escape(e.id);
        try { if (document.querySelectorAll(sel).length === 1) { parts.unshift(sel); return parts.join(' > '); } } catch (_) {}
      }
      let i = 1;
      for (let s = e.previousElementSibling; s; s = s.previousElementSibling) if (s.localName === e.localName) i++;
      parts.unshift(CSS.escape(e.localName) + ':nth-of-type(' + i + ')');
    }
    parts.unshift('body');
    return parts.join(' > ');
  }
  const docW = () => Math.max(document.documentElement.scrollWidth, document.documentElement.clientWidth);
  const docH = () => Math.max(document.documentElement.scrollHeight, document.body.scrollHeight);
  const clamp = (v, a, b) => Math.min(Math.max(v, a), b);

  function makeAnchor(el, cx, cy) {
    const r = el.getBoundingClientRect();
    return {
      selector: cssPath(el),
      rx: r.width ? clamp((cx - r.left) / r.width, 0, 1) : 0.5,
      ry: r.height ? clamp((cy - r.top) / r.height, 0, 1) : 0.5,
      px: clamp((cx + scrollX) / docW(), 0, 1),
      py: Math.round(cy + scrollY),
      vw: innerWidth
    };
  }
  function anchorPos(a) {
    let el = null;
    try { el = a.selector ? document.querySelector(a.selector) : null; } catch (_) {}
    let x, y;
    if (el && visible(el) && getComputedStyle(el).visibility !== 'hidden') {
      const r = el.getBoundingClientRect();
      x = r.left + scrollX + r.width * a.rx;
      y = r.top + scrollY + r.height * a.ry;
    } else {
      x = (a.px || 0) * docW();
      y = a.py || 0;
    }
    return { x: clamp(x, 7, docW() - 7), y: clamp(y, 7, docH() - 7) };
  }

  /* ---------- точки ---------- */
  function renderDots() {
    const keep = new Set();
    notes.forEach((n, id) => {
      keep.add(id);
      let d = layer.querySelector('[data-id="' + CSS.escape(id) + '"]');
      if (!d) {
        d = document.createElement('button');
        d.type = 'button';
        d.className = 'dot';
        d.dataset.id = id;
        d.setAttribute('aria-label', 'Замечание');
        bindDot(d, () => openExisting(id));
        layer.appendChild(d);
      }
      d.style.background = COLORS[n.device] || COLORS.desktop;
      d.classList.toggle('active', !!(panel && panel.noteId === id));
    });
    layer.querySelectorAll('.dot[data-id]').forEach(d => { if (!keep.has(d.dataset.id)) d.remove(); });
    layoutDots();
  }
  // Точка открывается по отпусканию пальца/кнопки без сдвига. События не уходят сайту
  // (свайп-ленты, слайдеры), перетаскивание отключено.
  function bindDot(d, open) {
    let start = null, lastOpen = 0;
    d.draggable = false;
    const stop = e => e.stopPropagation();
    ['touchstart', 'touchmove', 'touchend', 'mousedown', 'mouseup', 'dragstart'].forEach(t =>
      d.addEventListener(t, e => { stop(e); if (t === 'dragstart') e.preventDefault(); }, { passive: false }));
    d.addEventListener('pointerdown', e => {
      stop(e);
      start = { x: e.clientX, y: e.clientY };
      try { d.releasePointerCapture(e.pointerId); } catch (_) {}
    });
    d.addEventListener('pointerup', e => {
      stop(e);
      if (!start || Math.hypot(e.clientX - start.x, e.clientY - start.y) > 12) { start = null; return; }
      start = null;
      if (e.cancelable) e.preventDefault();
      lastOpen = Date.now();
      open();
    });
    d.addEventListener('pointercancel', () => { start = null; });
    d.addEventListener('contextmenu', e => { stop(e); e.preventDefault(); });
    d.addEventListener('click', e => {
      stop(e); e.preventDefault();
      if (Date.now() - lastOpen > 600) open(); // клавиатура или браузер без pointer-событий
    });
  }
  function layoutDots(fromScroll) {
    layer.querySelectorAll('.dot').forEach(d => {
      const n = d.dataset.id ? notes.get(d.dataset.id) : (tempDot && tempDot.note);
      if (!n) return;
      const p = anchorPos(n.anchor);
      d.style.left = (p.x - 6) + 'px';
      d.style.top = (p.y - 6) + 'px';
    });
    if (panel && !fromScroll) placePanel();
  }
  let layoutFull = false;
  function scheduleLayout(e) {
    if (!(e && e.type === 'scroll')) layoutFull = true;
    if (rafPending) return;
    rafPending = true;
    requestAnimationFrame(() => { rafPending = false; const f = layoutFull; layoutFull = false; layoutDots(!f); });
  }

  /* ---------- плашка ---------- */
  const el = (tag, cls, text) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  };

  function closePanel() {
    if (!panel) return;
    clearTimeout(panel.delTimer);
    panel.node.remove();
    panel = null;
    if (tempDot) { tempDot.node.remove(); tempDot = null; }
    renderDots();
  }

  function placePanel() {
    const n = panel.noteId ? notes.get(panel.noteId) : tempDot && tempDot.note;
    if (!n) return;
    const p = anchorPos(n.anchor);
    const box = panel.node, w = box.offsetWidth, h = box.offsetHeight;
    const vx = p.x - scrollX, vy = p.y - scrollY, gap = 14, m = 12;
    let left = vx + gap, top = vy + gap;
    if (left + w > innerWidth - m) left = vx - gap - w;
    if (top + h > innerHeight - m) top = vy - gap - h;
    left = clamp(left, m, Math.max(m, innerWidth - w - m));
    top = clamp(top, m, Math.max(m, innerHeight - h - m));
    box.style.left = (left + scrollX) + 'px';
    box.style.top = (top + scrollY) + 'px';
  }

  function deviceSwitch(value, onChange) {
    const wrap = el('div', 'seg');
    [['desktop', 'Компьютер'], ['mobile', 'Телефон']].forEach(([v, label]) => {
      const b = el('button', 'seg-b', label);
      b.type = 'button';
      b.dataset.v = v;
      b.style.setProperty('--c', COLORS[v]);
      b.addEventListener('click', () => {
        if (wrap.dataset.v === v) return;
        set(v); onChange(v);
      });
      wrap.appendChild(b);
    });
    function set(v) {
      wrap.dataset.v = v;
      wrap.querySelectorAll('.seg-b').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.v === v)));
    }
    set(value);
    wrap.set = set;
    return wrap;
  }

  function textArea(placeholder) {
    const t = el('textarea', 'ta');
    t.maxLength = MAXLEN;
    t.rows = 2;
    t.placeholder = placeholder;
    const grow = () => { t.style.height = 'auto'; t.style.height = Math.min(t.scrollHeight + 2, innerHeight * 0.4) + 'px'; if (panel) placePanel(); };
    t.addEventListener('input', grow);
    t.addEventListener('keydown', e => {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); panel && panel.commit(); }
    });
    return t;
  }

  function shell(onDone, onDelete) {
    const node = el('div', 'panel');
    node.setAttribute('role', 'dialog');
    ['keydown', 'keyup', 'keypress'].forEach(t => node.addEventListener(t, e => e.stopPropagation()));
    const body = el('div', 'body');
    const err = el('div', 'err');
    err.hidden = true;
    const actions = el('div', 'actions');
    const del = el('button', 'btn ghost', 'Удалить'); del.type = 'button';
    const done = el('button', 'btn main', 'Готово'); done.type = 'button';
    del.addEventListener('click', onDelete);
    done.addEventListener('click', onDone);
    const edit = el('button', 'btn ghost', 'Редактировать'); edit.type = 'button'; edit.hidden = true;
    actions.append(del, edit, done);
    node.append(body, err, actions);
    layer.appendChild(node);
    return { node, body, err, del, done, edit };
  }
  function setBusy(p, busy) {
    p.busy = busy;
    p.node.classList.toggle('busy', busy);
    p.done.disabled = p.del.disabled = p.edit.disabled = busy;
  }
  function showErr(p, msg) { p.err.textContent = msg || ERR; p.err.hidden = false; placePanel(); }

  /* новая заметка */
  function openNew(target, cx, cy) {
    closeOrCommit();
    if (panel) return; // текущую не удалось закрыть
    lastOpenAt = Date.now();
    const note = { device: defaultDevice(), anchor: makeAnchor(target, cx, cy) };
    const dot = el('button', 'dot temp');
    dot.type = 'button';
    dot.tabIndex = -1;
    layer.appendChild(dot);
    tempDot = { node: dot, note };
    const paint = () => { dot.style.background = COLORS[note.device]; };
    paint();

    const p = shell(() => p.commit(), () => closePanel());
    panel = p;
    const ta = textArea('Замечание…');
    const sw = deviceSwitch(note.device, v => { note.device = v; paint(); });
    p.body.append(ta, sw);
    p.commit = async () => {
      if (p.busy) return;
      const text = ta.value.slice(0, MAXLEN);
      if (!text.trim()) return closePanel();
      setBusy(p, true);
      mutationSeq++;
      try {
        const rows = await api('POST', 'select=*', {
          site_id: CONFIG.SITE_ID, page: PAGE, device: note.device, text, anchor: note.anchor
        }, 'return=representation');
        const row = rows && rows[0];
        if (row) notes.set(row.id, row);
        hideHint();
        if (panel === p) closePanel(); else renderDots();
      } catch (e) {
        log('сохранение', e);
        setBusy(p, false);
        showErr(p);
      }
    };
    layoutDots();
    placePanel();
    try { ta.focus({ preventScroll: true }); } catch (_) {}
  }

  /* открытая заметка */
  function openExisting(id) {
    if (panel && panel.noteId === id) return;
    closeOrCommit();
    if (panel) return;
    const n = notes.get(id);
    if (!n) return;
    lastOpenAt = Date.now();
    const p = shell(() => p.commit(), () => p.remove());
    p.noteId = id;
    panel = p;
    let ta = null, editing = null; // editing: { text, reply, reply2 } -> textarea

    p.edit.hidden = false;
    p.edit.addEventListener('click', () => {
      if (p.busy) return;
      editing = editing ? null : {};
      p.edit.textContent = editing ? 'Отменить' : 'Редактировать';
      p.err.hidden = true;
      draw();
      const first = p.body.querySelector('.ta');
      if (first) { try { first.focus({ preventScroll: true }); first.setSelectionRange(first.value.length, first.value.length); } catch (_) {} }
    });
    const editBox = (field, value, placeholder) => {
      const t = textArea(placeholder);
      t.value = value;
      editing[field] = t;
      requestAnimationFrame(() => t.dispatchEvent(new Event('input')));
      return t;
    };

    function draw(keepText) {
      const row = notes.get(id);
      p.body.textContent = '';
      if (editing) {
        p.body.append(editBox('text', row.text, 'Замечание'));
        if (row.reply) { const r = el('div', 'reply'); r.append(el('div', 'lbl', 'Ответ'), editBox('reply', row.reply, 'Ответ')); p.body.append(r); }
        if (row.reply2) { const r = el('div', 'reply r2'); r.append(el('div', 'lbl', 'Ответ на ответ'), editBox('reply2', row.reply2, 'Ответ на ответ')); p.body.append(r); }
        ta = null;
        if (panel === p) placePanel();
        return;
      }
      p.body.append(el('div', 'txt', row.text));
      const d = new Date(row.created_at);
      p.body.append(el('div', 'meta', isNaN(d) ? '' : d.toLocaleString('ru-RU', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })));
      if (row.reply) { const r = el('div', 'reply'); r.append(el('div', 'lbl', 'Ответ'), el('div', 'txt', row.reply)); p.body.append(r); }
      if (row.reply2) { const r = el('div', 'reply r2'); r.append(el('div', 'lbl', 'Ответ на ответ'), el('div', 'txt', row.reply2)); p.body.append(r); }
      ta = null;
      if (!row.reply2) {
        ta = textArea(row.reply ? 'Ответить на ответ' : 'Ответить');
        if (keepText) ta.value = keepText;
        p.body.append(ta);
        if (keepText) ta.dispatchEvent(new Event('input'));
      }
      const sw = deviceSwitch(row.device, async v => {
        const prev = row.device;
        row.device = v; renderDots(); mutationSeq++;
        try {
          const res = await api('PATCH', byId(id) + '&select=*', { device: v, updated_at: new Date().toISOString() }, 'return=representation');
          if (res && res[0]) notes.set(id, Object.assign(notes.get(id) || {}, res[0]));
          else { notes.delete(id); closePanel(); renderDots(); }
        } catch (e) {
          log('тип', e);
          row.device = prev; sw.set(prev); renderDots();
          if (panel === p) showErr(p);
        }
      });
      p.body.append(sw);
      if (panel === p) placePanel();
    }
    draw();

    p.commit = async () => {
      if (p.busy) return;
      if (editing) return saveEdit();
      const text = ta ? ta.value.slice(0, MAXLEN) : '';
      if (!text.trim()) return closePanel();
      setBusy(p, true);
      mutationSeq++;
      try {
        const fresh = await api('GET', byId(id) + '&select=*');
        if (!fresh || !fresh[0]) { notes.delete(id); closePanel(); renderDots(); return; }
        const local = notes.get(id);
        const wanted = local.reply ? 'reply2' : 'reply';
        notes.set(id, fresh[0]);
        const slot = !fresh[0].reply ? 'reply' : !fresh[0].reply2 ? 'reply2' : null;
        if (slot !== wanted) { // пока писали, кто-то ответил
          setBusy(p, false); draw(text);
          showErr(p, slot ? 'Пока вы писали, появился новый ответ — проверьте и отправьте ещё раз' : 'Пока вы писали, цепочка заполнилась — больше ответить нельзя');
          return;
        }
        const res = await api('PATCH', byId(id) + '&' + slot + '=is.null&select=*',
          { [slot]: text, updated_at: new Date().toISOString() }, 'return=representation');
        if (res && res[0]) { notes.set(id, res[0]); if (panel === p) closePanel(); return; }
        const again = await api('GET', byId(id) + '&select=*');
        if (!again || !again[0]) { notes.delete(id); closePanel(); renderDots(); return; }
        notes.set(id, again[0]); setBusy(p, false); draw(text);
        showErr(p, 'Пока вы писали, появился новый ответ — проверьте');
      } catch (e) {
        log('ответ', e);
        setBusy(p, false);
        showErr(p);
      }
    };

    async function saveEdit() {
      const row = notes.get(id), patch = {};
      Object.keys(editing).forEach(f => {
        const v = editing[f].value.slice(0, MAXLEN);
        if (v.trim() && v !== row[f]) patch[f] = v; // пустое поле — оставить как было
      });
      if (!Object.keys(patch).length) return closePanel();
      setBusy(p, true);
      mutationSeq++;
      try {
        patch.updated_at = new Date().toISOString();
        const res = await api('PATCH', byId(id) + '&select=*', patch, 'return=representation');
        if (res && res[0]) notes.set(id, res[0]); else notes.delete(id);
        if (panel === p) closePanel(); else renderDots();
      } catch (e) {
        log('правка', e);
        setBusy(p, false);
        showErr(p);
      }
    }

    p.remove = async () => {
      if (p.busy) return;
      if (!p.confirmDel) {
        p.confirmDel = true;
        p.del.textContent = 'Точно удалить?';
        p.del.classList.add('danger');
        p.delTimer = setTimeout(() => { p.confirmDel = false; p.del.textContent = 'Удалить'; p.del.classList.remove('danger'); }, 3000);
        return;
      }
      clearTimeout(p.delTimer);
      setBusy(p, true);
      mutationSeq++;
      try {
        await api('DELETE', byId(id));
        notes.delete(id);
        if (panel === p) closePanel();
        renderDots();
      } catch (e) {
        log('удаление', e);
        setBusy(p, false);
        p.confirmDel = false; p.del.textContent = 'Удалить'; p.del.classList.remove('danger');
        showErr(p);
      }
    };
    renderDots();
    placePanel();
  }

  /* подсказка для заказчика: один раз, до закрытия или первой заметки */
  const HINT_KEY = 'review-notes-hint:' + CONFIG.SITE_ID;
  let hint = null;
  function showHint() {
    try { if (localStorage.getItem(HINT_KEY)) return; } catch (_) {}
    hint = el('div', 'hint');
    hint.setAttribute('role', 'status');
    const touchFirst = matchMedia('(pointer: coarse)').matches;
    const msg = touchFirst
      ? 'Чтобы оставить замечание, подержите палец на месте, о котором хотите написать'
      : 'Чтобы оставить замечание, зажмите левую кнопку мыши на нужном месте на полсекунды';
    const ok = el('button', 'btn', 'Понятно');
    ok.type = 'button';
    ok.addEventListener('click', hideHint);
    hint.append(el('i'), el('span', null, msg), ok);
    layer.appendChild(hint);
  }
  function hideHint() {
    if (!hint) return;
    hint.remove(); hint = null;
    try { localStorage.setItem(HINT_KEY, '1'); } catch (_) {}
  }

  function closeOrCommit() { if (panel && !panel.busy) panel.commit(); }

  /* ---------- вызов ---------- */
  function eligible(target, path, force) {
    if (!target || !(target instanceof Element)) return false;
    if (path && path.includes(host)) return false;
    if (force) return !target.closest(FIELDS); // зажатие левой кнопки: на любом блоке, кроме полей ввода
    if (target.closest(EXCLUDE)) return false;
    const sel = window.getSelection && window.getSelection();
    if (sel && !sel.isCollapsed && String(sel).trim()) return false;
    return true;
  }

  function onContextMenu(e) {
    if (e.defaultPrevented) return;
    const path = e.composedPath ? e.composedPath() : [];
    if (!eligible(e.target, path)) return;
    e.preventDefault();
    cancelTouch();
    if (lastSrc === 'touch' && Date.now() - lastSrcAt < 800) return; // Android: долгий тап + contextmenu
    lastSrc = 'mouse'; lastSrcAt = Date.now();
    openNew(e.target, e.clientX, e.clientY);
  }

  let touch = null;
  function cancelTouch() {
    if (!touch) return;
    clearTimeout(touch.timer);
    document.documentElement.style.removeProperty('-webkit-user-select');
    document.documentElement.style.removeProperty('-webkit-touch-callout');
    if (!touch.fired) touch = null;
  }
  function onTouchStart(e) {
    if (touch) { cancelTouch(); touch = null; }
    if (e.touches.length !== 1) return;
    const t = e.touches[0];
    const path = e.composedPath ? e.composedPath() : [];
    if (!eligible(e.target, path)) return;
    const st = document.documentElement.style;
    st.setProperty('-webkit-user-select', 'none'); // iOS: без выделения и выноски на время удержания
    st.setProperty('-webkit-touch-callout', 'none');
    touch = {
      x: t.clientX, y: t.clientY, target: e.target, fired: false,
      timer: setTimeout(() => {
        if (!touch) return;
        touch.fired = true;
        const tt = touch;
        cancelTouch();
        if (lastSrc === 'mouse' && Date.now() - lastSrcAt < 800) return;
        lastSrc = 'touch'; lastSrcAt = Date.now();
        try { const s = getSelection(); s && s.removeAllRanges(); } catch (_) {}
        openNew(tt.target, tt.x, tt.y);
      }, 550)
    };
  }
  function onTouchMove(e) {
    if (!touch || touch.fired) return;
    const t = e.touches[0];
    if (!t || Math.hypot(t.clientX - touch.x, t.clientY - touch.y) > 10 || e.touches.length > 1) cancelTouch();
  }
  function onTouchEnd(e) {
    if (!touch) return;
    const fired = touch.fired;
    cancelTouch();
    touch = null;
    if (fired && e.cancelable) e.preventDefault(); // не пускать «клик» после долгого нажатия
  }

  /* зажатие левой кнопки мыши / тачпада ~550 мс — на любом месте, включая ссылки и картинки */
  let hold = null, eatClick = 0;
  function cancelHold() {
    if (!hold) return;
    clearTimeout(hold.timer);
    hold.ring.remove();
    hold = null;
  }
  function onHoldDown(e) {
    cancelHold();
    if (e.pointerType !== 'mouse' || e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;
    const path = e.composedPath();
    if (!eligible(e.target, path, true)) return;
    const ring = el('div', 'hold');
    ring.style.left = (e.clientX + scrollX - 14) + 'px';
    ring.style.top = (e.clientY + scrollY - 14) + 'px';
    layer.appendChild(ring);
    const h = hold = {
      x: e.clientX, y: e.clientY, target: e.target, ring,
      timer: setTimeout(() => {
        if (hold !== h) return;
        cancelHold();
        try { const s = getSelection(); s && s.removeAllRanges(); } catch (_) {}
        eatClick = Date.now();
        lastSrc = 'mouse'; lastSrcAt = Date.now();
        openNew(h.target, h.x, h.y);
      }, 550)
    };
  }
  function onHoldMove(e) {
    if (hold && Math.hypot(e.clientX - hold.x, e.clientY - hold.y) > 10) cancelHold();
  }
  function onHoldUp(e) {
    cancelHold();
    if (eatClick && Date.now() - eatClick < 5000 && e.type === 'pointerup') e.preventDefault();
  }
  function onClickCapture(e) {
    // после зажатия не пускать клик по ссылке/кнопке под курсором
    if (!eatClick) return;
    const fresh = Date.now() - eatClick < 5000;
    eatClick = 0;
    if (fresh && !e.composedPath().includes(host)) { e.preventDefault(); e.stopImmediatePropagation(); }
  }

  function onPointerDown(e) {
    if (!panel || Date.now() - lastOpenAt < 350) return;
    const path = e.composedPath();
    if (path.includes(panel.node)) return;
    closeOrCommit();
  }
  function onKey(e) {
    if (!panel || e.key !== 'Escape') return;
    e.preventDefault();
    if (e.composedPath().includes(host)) e.stopPropagation();
    closeOrCommit();
  }

  /* ---------- старт ---------- */
  const CSS_TEXT = `
:host{all:initial}
.layer{position:absolute;left:0;top:0;width:0;height:0;overflow:visible;
  font-family:var(--rn-font);font-size:var(--rn-size);font-weight:var(--rn-weight);color:var(--rn-fg);line-height:1.4}
*{box-sizing:border-box}
.dot{position:absolute;left:0;top:0;width:12px;height:12px;padding:0;margin:0;border-radius:50%;
  border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.35),0 0 0 1px rgba(0,0,0,.12);cursor:pointer;
  transition:scale .15s ease, box-shadow .15s ease;-webkit-tap-highlight-color:transparent;
  touch-action:none;user-select:none;-webkit-user-select:none;-webkit-user-drag:none;-webkit-touch-callout:none}
.dot::after{content:"";position:absolute;inset:-10px;border-radius:50%}
.dot:hover,.dot.active{scale:1.4}
.dot.active,.dot.temp{box-shadow:0 0 0 3px rgba(0,0,0,.18),0 1px 4px rgba(0,0,0,.35)}
.panel{position:absolute;width:min(280px,calc(100vw - 24px));background:var(--rn-bg);color:var(--rn-fg);
  border:1px solid color-mix(in srgb,var(--rn-fg) 16%,transparent);border-radius:var(--rn-panel-radius);
  box-shadow:0 6px 24px rgba(0,0,0,.14);padding:10px;display:flex;flex-direction:column;gap:8px;
  font:inherit;text-align:left;letter-spacing:normal;text-transform:none}
.panel.busy{opacity:.7}
.body{display:flex;flex-direction:column;gap:8px;max-height:min(60vh,520px);overflow:auto}
.txt{white-space:pre-wrap;overflow-wrap:anywhere}
.meta{opacity:.6;margin-top:-4px}
.reply{border-left:2px solid var(--rn-accent);padding-left:8px}
.lbl{opacity:.6}
.ta{width:100%;min-height:44px;resize:none;font:inherit;color:inherit;background:transparent;
  border:1px solid color-mix(in srgb,var(--rn-fg) 22%,transparent);border-radius:var(--rn-panel-radius);
  padding:6px 8px;outline:none;line-height:1.4}
.ta:focus{border-color:var(--rn-accent)}
.ta::placeholder{color:inherit;opacity:.5}
.seg{display:flex;gap:4px}
.seg-b,.btn{font:inherit;color:inherit;background:transparent;cursor:pointer;margin:0;line-height:1.2;
  border:1px solid color-mix(in srgb,var(--rn-fg) 22%,transparent);border-radius:var(--rn-radius);padding:5px 9px}
.seg-b{flex:1;display:flex;align-items:center;justify-content:center;gap:6px;opacity:.65}
.seg-b::before{content:"";width:8px;height:8px;border-radius:50%;background:var(--c);flex:none}
.seg-b[aria-pressed="true"]{opacity:1;border-color:var(--rn-fg)}
.actions{display:flex;flex-wrap:wrap;justify-content:space-between;gap:6px}
.actions .btn.main{margin-left:auto}
.btn[hidden]{display:none}
.btn.main{background:var(--rn-accent);border-color:var(--rn-accent);color:var(--rn-on-accent)}
.btn.danger{border-color:#E5322D;color:#E5322D}
.btn:disabled{cursor:default}
.err{color:#E5322D}
.err[hidden]{display:none}
.hold{position:absolute;left:0;top:0;width:28px;height:28px;border-radius:50%;pointer-events:none;
  border:2px solid #E5322D;box-shadow:0 0 0 1px rgba(255,255,255,.8);opacity:0;scale:.3;
  animation:rn-hold .55s linear .12s forwards}
@keyframes rn-hold{to{opacity:1;scale:1}}
.hint{position:fixed;left:16px;bottom:16px;max-width:min(340px,calc(100vw - 32px));display:flex;align-items:center;gap:10px;
  background:var(--rn-bg);color:var(--rn-fg);border:1px solid color-mix(in srgb,var(--rn-fg) 16%,transparent);
  border-radius:var(--rn-panel-radius);box-shadow:0 6px 24px rgba(0,0,0,.16);padding:8px 8px 8px 12px;
  font:inherit;line-height:1.35;animation:rn-in .3s ease both}
.hint i{font-style:normal;width:10px;height:10px;border-radius:50%;background:#E5322D;border:2px solid #fff;
  box-shadow:0 1px 3px rgba(0,0,0,.3);flex:none}
.hint span{flex:1}
@media (pointer:coarse){.hint{bottom:calc(88px + env(safe-area-inset-bottom,0px))}}
@keyframes rn-in{from{opacity:0;translate:0 8px}}
@media (prefers-reduced-motion:reduce){.hint{animation-duration:1ms}}
button:focus-visible{outline:2px solid var(--rn-accent);outline-offset:1px}
`;

  function init() {
    host = document.createElement('review-notes-root');
    host.setAttribute('data-no-review', '');
    host.style.cssText = 'all:initial!important;position:absolute!important;left:0!important;top:0!important;' +
      'width:0!important;height:0!important;overflow:visible!important;z-index:2147483647!important;display:block!important;';
    root = host.attachShadow({ mode: 'open' });
    const style = document.createElement('style');
    style.textContent = CSS_TEXT;
    layer = el('div', 'layer');
    root.append(style, layer);
    document.documentElement.appendChild(host);
    detectStyle();

    window.addEventListener('contextmenu', onContextMenu);
    document.addEventListener('touchstart', onTouchStart, { passive: true });
    document.addEventListener('touchmove', onTouchMove, { passive: true });
    document.addEventListener('touchend', onTouchEnd, { passive: false });
    document.addEventListener('touchcancel', () => { cancelTouch(); touch = null; }, { passive: true });
    window.addEventListener('scroll', e => { cancelHold(); if (touch && !touch.fired) { cancelTouch(); } scheduleLayout(e); }, { passive: true, capture: true });
    window.addEventListener('pointerdown', onPointerDown, true);
    window.addEventListener('pointerdown', onHoldDown, true);
    window.addEventListener('pointermove', onHoldMove, { capture: true, passive: true });
    window.addEventListener('pointerup', onHoldUp, true);
    window.addEventListener('pointercancel', cancelHold, true);
    window.addEventListener('dragstart', cancelHold, true);
    window.addEventListener('wheel', cancelHold, { capture: true, passive: true });
    window.addEventListener('blur', cancelHold);
    window.addEventListener('click', onClickCapture, true);
    window.addEventListener('keydown', onKey, true);
    window.addEventListener('resize', scheduleLayout);
    window.addEventListener('orientationchange', scheduleLayout);
    window.addEventListener('load', () => { detectStyle(); scheduleLayout(); });
    document.addEventListener('load', scheduleLayout, true); // картинки
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { detectStyle(); scheduleLayout(); });
    if ('ResizeObserver' in window) new ResizeObserver(scheduleLayout).observe(document.body);

    showHint();
    loadAll();
    setInterval(() => { if (!document.hidden) loadAll(); }, CONFIG.POLL_INTERVAL_MS);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) loadAll(); });
    window.addEventListener('focus', loadAll);
    NS.reload = loadAll;
  }

  if (document.body) init(); else document.addEventListener('DOMContentLoaded', init);
})();
