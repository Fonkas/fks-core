'use strict';

/* =====================================================================
   FKS UI runtime: draws the views scripts open with exports['fks-core']:UIOpen and sends the
   clicks back. Components register with
       FKS.component(type, { render(props, ctx) -> Element, update?(el, props, ctx) })
   Reference: docs/UI-API.md
   ===================================================================== */
const FKS = (() => {
    const NS = 'http://www.w3.org/2000/svg';
    const registry = {};

    // Everything about the open panel. The view object is kept as sent by Lua; patches mutate it,
    // so a later re-render keeps them.
    const S = {
        open: false, owner: null, opts: {}, view: null,
        pageId: null, history: [], values: {}, errors: {}, nodes: {},
        keys: {},                                   // page shortcuts registered by components (carousel arrows)
        hidden: false, suspended: false,
    };

    /* ------------------------------------------------------------ helpers */
    const el = (tag, cls, text) => {
        const e = document.createElement(tag);
        if (cls) e.className = cls;
        if (text !== undefined && text !== null) e.textContent = text;
        return e;
    };
    const icon = (name, cls = 'ico') => {
        const s = document.createElementNS(NS, 'svg');
        if (cls) s.setAttribute('class', cls);
        const u = document.createElementNS(NS, 'use');
        u.setAttribute('href', `#i-${String(name).replace(/^i-/, '')}`);
        s.appendChild(u);
        return s;
    };
    // Lua arrays with holes or empty tables arrive as objects / [] - always get a clean array
    const arr = (v) => (Array.isArray(v) ? v : (v && typeof v === 'object' ? Object.values(v) : [])).filter((x) => x !== null && x !== undefined && x !== false);
    const txt = (v) => (v === undefined || v === null || v === false ? '' : String(v));
    const tr = (key, ...args) => (typeof t === 'function' ? t(key, ...args) : key);

    // leading call, then at most one call per `ms`, always ending with the latest value
    const throttles = {};
    function throttle(key, fn, ms) {
        const th = throttles[key] || (throttles[key] = { last: 0, timer: null, fn: null });
        th.fn = fn;
        const wait = ms - (Date.now() - th.last);
        if (wait <= 0 && !th.timer) { th.last = Date.now(); fn(); return; }
        if (!th.timer) th.timer = setTimeout(() => { th.last = Date.now(); th.timer = null; th.fn(); }, Math.max(wait, 0));
    }
    const debounces = {};
    function debounce(key, fn, ms) {
        clearTimeout(debounces[key]);
        debounces[key] = setTimeout(fn, ms);
    }

    /* ------------------------------------------------------------ talking to Lua */
    async function call(name, data) {
        if (!IN_GAME) return FKS.dev ? FKS.dev(name, data) : {};
        try {
            const r = await fetch(`https://${RES}/${name}`, { method: 'POST', body: JSON.stringify(data) });
            const json = await r.json();
            return json && typeof json === 'object' ? json : {};
        } catch (e) {
            return { ok: false };
        }
    }
    const send = (action, data = {}) => call('ui:action', { action, data });

    // Light emit for continuous controls (dials, sliders, camera, page changes): no busy state.
    function emit(action, data = {}) {
        if (!action || !S.open) return Promise.resolve(null);
        return send(action, { ...data, values: { ...S.values }, page: S.pageId }).then((res) => { apply(res); return res; });
    }

    // Full action of a button-like prop: confirm / prompt / go / action.
    async function fire(p, extra = {}, src) {
        if (!p || !S.open) return null;
        if (src && (src.classList.contains('busy') || src.disabled)) return null;
        let promptValues = null;
        if (p.confirm) {
            const ok = await FKS.modal.confirm(typeof p.confirm === 'object' ? p.confirm : { text: p.confirm });
            if (!ok) return null;
        }
        if (p.prompt) {
            promptValues = await FKS.modal.prompt(p.prompt);
            if (!promptValues) return null;
        }
        if (p.go) go(p.go);
        if (!p.action) return null;
        const data = { ...extra };
        if (p.value !== undefined && data.value === undefined) data.value = p.value;
        data.values = promptValues || { ...S.values };
        data.page = S.pageId;
        if (src) src.classList.add('busy');
        const res = await send(p.action, data);
        if (src) src.classList.remove('busy');
        apply(res);
        return res;
    }

    // What a handler returned (docs/UI-API.md section 7)
    function apply(res) {
        if (!res || typeof res !== 'object' || !S.open) return;
        if (res.ok === false && (res.message || res.error)) FKS.toast(res.message || res.error, 'error');
        if (res.toast) FKS.toast(res.toast.text || res.toast, res.toast.type);
        if (res.back) back();
        if (res.view) update(res.view);
        if (res.go && res.data) setPage(res.go, res.data, true);
        if (res.page) setPage(S.pageId, res.page);
        if (res.go) go(res.go);
        if (res.patch) patch(res.patch);
        if (res.errors) showErrors(res.errors);
        if (res.close) close();
    }

    /* ------------------------------------------------------------ pages */
    // A one-page view (body at the top level) becomes pages.main; `subtitle` is its crumb title.
    function normalize(view) {
        const v = view && typeof view === 'object' ? view : {};
        if (!v.pages || typeof v.pages !== 'object' || Array.isArray(v.pages)) {
            v.pages = { main: { title: v.subtitle, count: v.count, desc: v.desc, body: v.body, nav: v.nav } };
            v.page = 'main';
        }
        return v;
    }
    const pages = () => (S.view ? S.view.pages : null);
    const pageOf = (id) => (S.view && S.view.pages[id]) || null;
    function firstPage(view) {
        if (view.page && view.pages[view.page]) return view.page;
        return Object.keys(view.pages)[0];
    }

    function go(id, replace) {
        if (!pageOf(id) || id === S.pageId) return;
        const from = S.pageId;
        if (!replace) S.history.push(from);
        S.pageId = id;
        render(true);
        emit('page', { from, to: id });
    }
    function back() {
        if (!S.history.length) return;
        const from = S.pageId;
        S.pageId = S.history.pop();
        render(true);
        emit('page', { from, to: S.pageId, back: true });
    }
    function setPage(id, page, silent) {
        if (!S.view || !page) return;
        S.view.pages[id] = page;
        if (!silent && id === S.pageId) render(false);
    }

    /* ------------------------------------------------------------ values & errors (form fields) */
    function value(name, fallback) {
        if (!name) return fallback;
        if (!(name in S.values)) S.values[name] = fallback;
        return S.values[name];
    }
    function setValue(name, v) {
        if (!name) return;
        S.values[name] = v;
        document.querySelectorAll('#ui [data-requires]').forEach((b) => {
            if (b.dataset.requires === name) b.disabled = v === undefined || v === null || v === '' || v === false;
        });
        if (S.errors[name]) {
            delete S.errors[name];
            document.querySelectorAll(`#ui [data-field="${CSS.escape(name)}"]`).forEach((f) => {
                f.classList.remove('invalid');
                const e = f.querySelector('.err');
                if (e) e.textContent = '';
            });
        }
    }
    // finds the page whose body has a field with this name
    function pageWithField(name) {
        const has = (list) => arr(list).some((c) => c && (c.name === name || has(c.children) || has(c.fields)));
        const ps = pages();
        if (has(ps[S.pageId] && ps[S.pageId].body)) return S.pageId;
        return Object.keys(ps).find((id) => has(ps[id].body)) || S.pageId;
    }
    function showErrors(errors) {
        S.errors = { ...errors };
        const names = Object.keys(S.errors);
        if (!names.length) return;
        const target = pageWithField(names[0]);
        if (target !== S.pageId) go(target, true); else render(false);
        setTimeout(() => {
            const bad = document.querySelector('#ui .field.invalid');
            if (bad) bad.scrollIntoView({ block: 'center', behavior: 'smooth' });
        }, 30);
    }

    /* ------------------------------------------------------------ components */
    function component(type, def) { registry[type] = def; }

    function register(id, entry) { if (id !== undefined && id !== null && id !== '') S.nodes[id] = entry; }

    // c = the context handed to components (a prompt modal passes its own, with its own values)
    function renderNode(p, c = ctx) {
        if (!p || typeof p !== 'object' || !p.type) return null;
        const comp = registry[p.type];
        if (!comp) {
            console.warn(`[fks-core] unknown UI component "${p.type}"`);
            return null;
        }
        let node;
        try {
            node = comp.render(p, c);
        } catch (e) {
            console.error(`[fks-core] component "${p.type}" failed`, e);
            return null;
        }
        if (!node) return null;
        if (p.hidden) node.classList.add('hidden');
        if (p.class) node.classList.add(...String(p.class).split(/\s+/).filter(Boolean));
        if (p.id !== undefined) c.register(p.id, { el: node, props: p, comp });
        return node;
    }
    function renderList(list, parent, c = ctx) {
        arr(list).forEach((p) => {
            const n = renderNode(p, c);
            if (n) parent.appendChild(n);
        });
        return parent;
    }

    function patch(patches) {
        Object.entries(patches || {}).forEach(([id, props]) => {
            if (!props || typeof props !== 'object') return;
            if (BUILTIN[id]) { BUILTIN[id](props); return; }
            const n = S.nodes[id];
            if (!n) return;
            Object.assign(n.props, props);
            if (n.props.name && 'value' in props) S.values[n.props.name] = props.value;
            if (n.update) {
                n.update(n.props);
            } else if (n.comp && n.comp.update) {
                n.comp.update(n.el, n.props, ctx);
            } else if (n.el && n.el.isConnected) {
                const fresh = renderNode(n.props);
                if (fresh) n.el.replaceWith(fresh);
                return;
            }
            if (n.el && 'hidden' in props) n.el.classList.toggle('hidden', !!props.hidden);
        });
    }

    /* ------------------------------------------------------------ shell */
    const D = {};
    const $ui = (id) => document.getElementById(id);
    function mount() {
        ['ui', 'ui-panel', 'ui-eyebrow', 'ui-title', 'ui-crumbs', 'ui-back', 'ui-prev', 'ui-next', 'ui-crumb', 'ui-count',
            'ui-desc', 'ui-tabs', 'ui-view', 'ui-foot', 'ui-foot-btns', 'ui-money', 'ui-hints', 'ui-main', 'ui-stage']
            .forEach((id) => { D[id.replace('ui-', '').replace(/-(\w)/g, (_, c) => c.toUpperCase())] = $ui(id); });
        D.root = $ui('ui');
        D.back.addEventListener('click', back);
        D.prev.addEventListener('click', () => nav('prev'));
        D.next.addEventListener('click', () => nav('next'));
    }

    const current = () => pageOf(S.pageId) || {};
    const footerOf = () => ({ ...(S.view.footer || {}), ...(current().footer || {}) });
    const cameraOf = () => {
        const pg = current();
        return pg.camera !== undefined ? pg.camera : S.view.camera;
    };

    function nav(dir) {
        const target = (current().nav || {})[dir];
        if (!target) return;
        if (typeof target === 'string') go(target, true);
        else fire(target, {}, dir === 'prev' ? D.prev : D.next);
    }

    function renderHeader() {
        const v = S.view, pg = current();
        D.eyebrow.textContent = txt(pg.eyebrow !== undefined ? pg.eyebrow : v.eyebrow);
        D.title.textContent = txt(pg.heading !== undefined ? pg.heading : v.title);
        fitTitle();

        const navs = pg.nav || null;                  // prev / next replace the history back button
        const showBack = S.history.length > 0 && pg.back !== false && !navs;
        D.back.classList.toggle('hidden', !showBack);
        D.prev.classList.toggle('hidden', !navs);
        D.next.classList.toggle('hidden', !navs);
        if (navs) {
            D.prev.disabled = !navs.prev;
            D.next.disabled = !navs.next;
        }
        D.crumb.textContent = txt(pg.title);
        D.count.textContent = txt(pg.count);
        D.crumbs.classList.toggle('hidden', !pg.title && !showBack && !navs && !pg.count);

        D.desc.textContent = txt(pg.desc);
        D.desc.classList.toggle('hidden', !pg.desc);

        const center = (pg.layout || v.layout) === 'center';
        const tabs = arr(pg.tabs !== undefined ? pg.tabs : (center ? [] : v.tabs));
        D.tabs.innerHTML = '';
        tabs.forEach((tab) => {
            const b = el('button', `chip${tab.page === S.pageId ? ' on' : ''}`, tab.label);
            b.addEventListener('click', () => go(tab.page, true));
            D.tabs.appendChild(b);
        });
        D.tabs.classList.toggle('hidden', !tabs.length);
    }

    // long titles shrink instead of being cut
    function fitTitle() {
        const h = D.title;
        h.style.fontSize = '';
        if (!h.textContent || !h.clientWidth) return;
        let size = parseFloat(getComputedStyle(h).fontSize);
        let guard = 12;
        while (h.scrollWidth > h.clientWidth && guard-- > 0) {
            size *= 0.92;
            h.style.fontSize = `${size}px`;
        }
    }

    function renderFooter() {
        const f = footerOf();
        const pg = current();
        const hints = arr(pg.hints !== undefined ? pg.hints : S.view.hints);

        D.footBtns.innerHTML = '';
        renderList(f.buttons, D.footBtns);

        D.money.innerHTML = '';
        if (f.money) {
            const m = f.money;
            if (m.cash !== undefined && m.cash !== null) {
                const c = el('span', 'cash');
                c.append(el('em', '', '$'), el('b', '', fmt(m.cash)));
                D.money.appendChild(c);
            }
            if (m.gold !== undefined && m.gold !== null) {
                const g = el('span', 'gold');
                g.append(icon('gold', ''), el('b', '', fmt(m.gold, 2)));
                D.money.appendChild(g);
            }
        }

        D.hints.innerHTML = '';
        hints.forEach((h) => {
            const row = el('span', 'hint');
            const pair = arr(h);
            row.append(el('kbd', '', pair[0]), ` ${txt(pair[1])}`);
            D.hints.appendChild(row);
        });

        D.main.innerHTML = '';
        if (f.main) {
            const n = renderNode({ type: 'button', style: 'main', iconRight: 'fwd', ...f.main, id: undefined });
            if (n) D.main.appendChild(n);
        }

        const empty = !D.footBtns.children.length && !D.money.children.length && !hints.length && !f.main;
        D.foot.classList.toggle('hidden', empty);
    }

    const fmt = (n, dec = 0) => {
        const x = Number(n);
        if (!Number.isFinite(x)) return txt(n);
        return x.toLocaleString('en-US', { minimumFractionDigits: dec && x % 1 ? dec : 0, maximumFractionDigits: dec });
    };

    function render(animate) {
        if (!S.view) return;
        const pg = current();
        const layout = pg.layout || S.view.layout || 'side';
        D.root.dataset.layout = layout;
        D.root.dataset.position = S.opts.position || (THEME.position || 'left');

        const keepScroll = !animate && D.view.dataset.page === S.pageId ? D.view.scrollTop : 0;
        S.nodes = {};
        S.keys = {};
        renderHeader();
        D.view.innerHTML = '';
        D.view.dataset.page = S.pageId;
        renderList(pg.body, D.view);
        D.view.scrollTop = keepScroll;
        renderFooter();
        FKS.camera.set(cameraOf());
        if (animate) {
            D.view.classList.remove('view-in');
            void D.view.offsetWidth;
            D.view.classList.add('view-in');
        }
    }

    // Built-in patch targets (header, footer pieces, camera)
    const BUILTIN = {
        title(p) { if ('text' in p) { S.view.title = p.text; D.title.textContent = txt(p.text); fitTitle(); } },
        eyebrow(p) { if ('text' in p) { S.view.eyebrow = p.text; D.eyebrow.textContent = txt(p.text); } },
        count(p) { if ('text' in p) { current().count = p.text; D.count.textContent = txt(p.text); } },
        desc(p) { if ('text' in p) { current().desc = p.text; renderHeader(); } },
        main(p) {
            const pg = current();
            const owner = pg.footer && pg.footer.main ? pg.footer : (S.view.footer = S.view.footer || {});
            owner.main = { ...(owner.main || {}), ...p };
            renderFooter();
        },
        money(p) {
            const owner = current().footer && current().footer.money ? current().footer : (S.view.footer = S.view.footer || {});
            owner.money = { ...(owner.money || {}), ...p };
            renderFooter();
        },
        camera(p) {
            const pg = current();
            const owner = pg.camera ? pg : S.view;
            if (!owner.camera) return;
            owner.camera.rail = { ...(owner.camera.rail || {}), ...p };
            FKS.camera.set(cameraOf());
        },
    };

    /* ------------------------------------------------------------ open / close */
    function open(d) {
        const fresh = d.fresh || !S.open || S.owner !== d.owner;
        S.open = true;
        S.owner = d.owner;
        S.opts = d.opts || {};
        S.view = normalize(d.view);
        S.hidden = false;
        if (fresh) {
            S.values = {};
            S.errors = {};
            FKS.modal.close();
        }
        S.history = [];
        S.pageId = firstPage(S.view);
        D.root.classList.remove('hidden');
        FKS.modal.attach(true);
        if (fresh) {
            D.panel.style.animation = 'none';
            void D.panel.offsetWidth;
            D.panel.style.animation = '';
        }
        render(true);
    }

    function update(view) {
        if (!S.open) return;
        S.view = normalize(view);
        if (!pageOf(S.pageId)) {
            S.pageId = firstPage(S.view);
            S.history = [];
        } else {
            S.history = S.history.filter((id) => pageOf(id));
        }
        render(false);
    }

    function close() {
        if (!S.open) return;
        S.open = false;
        S.view = null;
        S.nodes = {};
        S.history = [];
        D.root.classList.add('hidden');
        D.view.innerHTML = '';
        FKS.camera.set(null);
        FKS.modal.close();
        FKS.modal.attach(false);
    }

    async function requestClose(reason) {
        const res = await call('ui:close', { reason });
        if (IN_GAME ? res && res.closed : true) close();
    }

    function setHidden() {
        D.root.classList.toggle('hidden', !S.open || S.hidden || S.suspended);
        D.stage.classList.toggle('on', S.open && !S.hidden && !S.suspended && FKS.camera.active());
    }

    /* ------------------------------------------------------------ keyboard */
    const typing = (e) => /^(INPUT|TEXTAREA|SELECT)$/.test((e.target && e.target.tagName) || '');
    document.addEventListener('keydown', (e) => {
        if (FKS.modal.isOpen()) return;                      // the modal handles its own keys
        if (!S.open || S.hidden || S.suspended) return;
        if (e.key === 'Escape' || (e.key === 'Backspace' && !typing(e))) {
            e.preventDefault();
            if (S.history.length && current().back !== false) back();
            else if (S.opts.closable !== false) requestClose('esc');
        } else if (!typing(e) && S.keys[e.key]) {
            e.preventDefault();
            S.keys[e.key]();
        }
    });

    /* ------------------------------------------------------------ theme defaults (Config.Theme) */
    const THEME = {};

    /* ------------------------------------------------------------ messages from Lua */
    const messages = {
        'ui:open': open,
        'ui:update': (d) => update(d.view),
        'ui:page': (d) => setPage(d.id, d.page),
        'ui:patch': (d) => patch(d.patches),
        'ui:go': (d) => go(d.id),
        'ui:close': close,
        'ui:hidden': (d) => { S.hidden = !!d.on; setHidden(); },
        'ui:suspend': (d) => { S.suspended = !!d.on; setHidden(); },
    };

    return {
        S, D, NS, THEME, el, icon, arr, txt, tr, fmt, throttle, debounce, call, send, emit, fire, apply,
        component, renderNode, renderList, register, patch, go, back, value, setValue, open, close, update,
        requestClose, setHidden, messages, mount, current,
        isOpen: () => S.open,
    };
})();

// what components get as `ctx`
const ctx = {
    el: FKS.el, icon: FKS.icon, arr: FKS.arr, txt: FKS.txt, t: FKS.tr, fmt: FKS.fmt,
    emit: FKS.emit, fire: FKS.fire, go: FKS.go, back: FKS.back,
    value: FKS.value, setValue: FKS.setValue, error: (name) => FKS.S.errors[name],
    register: FKS.register, renderNode: FKS.renderNode, renderList: FKS.renderList,
    throttle: FKS.throttle, debounce: FKS.debounce,
    key: (name, fn) => { FKS.S.keys[name] = fn; },
};
