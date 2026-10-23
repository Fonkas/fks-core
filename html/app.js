'use strict';

const IN_GAME = typeof GetParentResourceName === 'function';
const RES = IN_GAME ? GetParentResourceName() : 'fks-core';
const $ = (id) => document.getElementById(id);

const post = (name, data = {}) => {
    if (!IN_GAME) return Promise.resolve();
    return fetch(`https://${RES}/${name}`, { method: 'POST', body: JSON.stringify(data) }).catch(() => {});
};

let L = {};
let cfg = { notify: { position: 'top-right', duration: 5000, max: 5 }, progress: { position: 'bottom', cancelKey: 'X' } };
const t = (key, ...args) => {
    let s = L[key] ?? key;
    args.forEach((a) => { s = s.replace('%s', a); });
    return s;
};

const applyLocale = () => {
    document.querySelectorAll('[data-l]').forEach((el) => { el.textContent = t(el.dataset.l); });
    $('it-search').placeholder = t('search');
    $('m-player-search').placeholder = t('search_player');
    $('pg-hint-text').textContent = t('cancel_hint');
};

/* ================================================================ logo
   The server owner drops html/logo.(png|webp|jpg|jpeg|svg) - first one that loads wins. */
let logoSrc = null;
const logoReady = new Promise((resolve) => {
    const tries = ['logo.png', 'logo.webp', 'logo.jpg', 'logo.jpeg', 'logo.svg'];
    const next = () => {
        const src = tries.shift();
        if (!src) return resolve(null);
        const img = new Image();
        img.onload = () => { logoSrc = src; resolve(src); };
        img.onerror = next;
        img.src = src;
    };
    next();
});

/* ================================================================ notifications */
const notifyBox = $('notify');

function notify(d) {
    const el = document.createElement('div');
    el.className = `ntf ${d.type || 'inform'}${logoSrc ? '' : ' no-logo'}`;

    const logo = document.createElement('div');
    logo.className = 'ntf-logo';
    if (logoSrc) {
        const img = document.createElement('img');
        img.src = logoSrc;
        logo.appendChild(img);
    }

    const body = document.createElement('div');
    body.className = 'ntf-body';
    if (d.title) {
        const title = document.createElement('div');
        title.className = 'ntf-title';
        title.textContent = d.title;
        body.appendChild(title);
    }
    if (d.description) {
        const msg = document.createElement('div');
        msg.className = 'ntf-msg';
        msg.textContent = d.description;
        body.appendChild(msg);
    }

    const duration = Number(d.duration) || cfg.notify.duration || 5000;
    const time = document.createElement('div');
    time.className = 'ntf-time';
    time.innerHTML = '<i></i>';
    time.firstChild.style.animationDuration = `${duration}ms`;

    el.append(logo, body, time);
    notifyBox.appendChild(el);

    // too many on screen: the oldest goes first
    const live = notifyBox.querySelectorAll('.ntf:not(.out)');
    if (live.length > (cfg.notify.max || 5)) dismiss(live[0]);

    el._timer = setTimeout(() => dismiss(el), duration);
}

function dismiss(el) {
    if (el.classList.contains('out')) return;
    clearTimeout(el._timer);
    el.classList.add('out');
    el.addEventListener('animationend', () => el.remove(), { once: true });
}

/* ================================================================ progress bar */
const pg = { el: $('progress'), raf: 0, hideTimer: 0 };

function progressStart(d) {
    clearTimeout(pg.hideTimer);
    cancelAnimationFrame(pg.raf);
    const el = pg.el;
    el.className = cfg.progress.position === 'center' ? 'center' : '';
    $('pg-label').textContent = d.label || '';
    $('pg-hint').classList.toggle('hidden', !d.canCancel);
    $('pg-key').textContent = cfg.progress.cancelKey || 'X';

    const duration = Math.max(Number(d.duration) || 0, 1);
    const start = performance.now();
    const fill = $('pg-fill'), spur = $('pg-spur'), pct = $('pg-pct');
    const frame = (now) => {
        const p = Math.min((now - start) / duration, 1);
        fill.style.width = `${p * 100}%`;
        spur.style.left = `${p * 100}%`;
        spur.style.transform = `rotate(${p * duration * 0.36}deg)`; // one turn per second
        pct.textContent = `${Math.floor(p * 100)}%`;
        if (p < 1) pg.raf = requestAnimationFrame(frame);
    };
    pg.raf = requestAnimationFrame(frame);
}

function progressEnd(d) {
    cancelAnimationFrame(pg.raf);
    const el = pg.el;
    if (d && d.cancelled) {
        el.classList.add('cancelled');
        $('pg-label').textContent = t('cancelled_label');
    } else {
        $('pg-fill').style.width = '100%';
        $('pg-spur').style.left = '100%';
        $('pg-pct').textContent = '100%';
    }
    pg.hideTimer = setTimeout(() => {
        el.classList.add('out');
        pg.hideTimer = setTimeout(() => { el.className = 'hidden'; }, 300);
    }, d && d.cancelled ? 650 : 150);
}

/* ================================================================ admin item panel */
const PLACEHOLDER = 'data:image/svg+xml;utf8,' + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><g fill="none" stroke="#a39a88" stroke-width="2.4" stroke-linejoin="round">' +
    '<path d="M14 24 L32 14 L50 24 L50 46 L32 56 L14 46 Z"/><path d="M14 24 L32 34 L50 24 M32 34 L32 56"/></g></svg>');

const it = {
    items: [], players: [], me: 0, maxAmount: 1000, maxWeapons: 10,
    cat: 'all', query: '', list: [], shown: 0,
    sel: null, target: 'self', player: null,
};
const PAGE = 120;
const CATS = ['all', 'item', 'weapon', 'ammo'];

// image with fallbacks: image -> image2 -> placeholder
function setImg(img, entry) {
    const srcs = [entry.image, entry.image2, PLACEHOLDER].filter(Boolean);
    let i = 0;
    img.onerror = () => { i += 1; if (i < srcs.length) img.src = srcs[i]; else img.onerror = null; };
    img.src = srcs[0];
}

function itemsOpen(d) {
    if (d.items) it.items = d.items;
    it.players = (d.players || []).filter((p) => p.id !== d.me);
    it.me = d.me;
    it.maxAmount = d.maxAmount || 1000;
    it.maxWeapons = d.maxWeapons || 10;
    $('items').classList.remove('hidden');
    closeModal();
    renderTabs();
    filter();
    setTimeout(() => $('it-search').focus(), 50);
}

function itemsClose() {
    $('items').classList.add('hidden');
    closeModal();
    post('items:close');
}

function renderTabs() {
    const counts = { all: it.items.length, item: 0, weapon: 0, ammo: 0 };
    it.items.forEach((e) => { counts[e.kind] = (counts[e.kind] || 0) + 1; });
    const tabs = $('it-tabs');
    tabs.innerHTML = '';
    CATS.forEach((c) => {
        if (c !== 'all' && !counts[c]) return;
        const b = document.createElement('button');
        b.className = c === it.cat ? 'on' : '';
        b.dataset.cat = c;
        b.innerHTML = `${t('cat_' + c)}<em>${counts[c]}</em>`;
        tabs.appendChild(b);
    });
}

const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

function filter() {
    const q = norm(it.query.trim());
    it.list = it.items.filter((e) => (it.cat === 'all' || e.kind === it.cat)
        && (!q || norm(e.label).includes(q) || norm(e.name).includes(q)));
    $('it-count').textContent = t('results', it.list.length);
    const grid = $('it-grid');
    grid.innerHTML = '';
    grid.scrollTop = 0;
    it.shown = 0;
    if (!it.list.length) {
        grid.innerHTML = `<div class="it-empty">${t('empty')}</div>`;
        return;
    }
    renderMore();
}

// cards are added in pages while scrolling (servers have thousands of items)
let sentinelObs = null;
function renderMore() {
    const grid = $('it-grid');
    grid.querySelector('.it-sentinel')?.remove();
    const frag = document.createDocumentFragment();
    const end = Math.min(it.shown + PAGE, it.list.length);
    for (let i = it.shown; i < end; i += 1) {
        const e = it.list[i];
        const card = document.createElement('button');
        card.className = 'it-item';
        card.dataset.idx = i;
        const box = document.createElement('div');
        box.className = 'img';
        const img = document.createElement('img');
        img.loading = 'lazy';
        setImg(img, e);
        box.appendChild(img);
        const label = document.createElement('div');
        label.className = 'label';
        label.textContent = e.label;
        const name = document.createElement('div');
        name.className = 'name';
        name.textContent = e.name;
        card.append(box, label, name);
        if (e.kind !== 'item') {
            const tag = document.createElement('i');
            tag.className = `tag ${e.kind}`;
            card.appendChild(tag);
        }
        frag.appendChild(card);
    }
    it.shown = end;
    grid.appendChild(frag);
    if (it.shown < it.list.length) {
        const s = document.createElement('div');
        s.className = 'it-sentinel';
        grid.appendChild(s);
        sentinelObs = sentinelObs || new IntersectionObserver((ents) => {
            if (ents.some((x) => x.isIntersecting)) renderMore();
        }, { root: grid, rootMargin: '300px' });
        sentinelObs.disconnect();
        sentinelObs.observe(s);
    }
}

/* give dialog */
const maxFor = (e) => (e && e.kind === 'weapon' ? it.maxWeapons : it.maxAmount);

function openModal(entry) {
    it.sel = entry;
    setImg($('m-img'), entry);
    $('m-kind').textContent = t('cat_' + entry.kind);
    $('m-label').textContent = entry.label;
    $('m-name').textContent = entry.name;
    $('m-desc').textContent = entry.desc || '';
    $('m-amount').value = 1;
    $('m-amount').max = maxFor(entry);

    const quick = $('m-quick');
    quick.innerHTML = '';
    [1, 5, 10, 25, 50, 100].filter((n) => n <= maxFor(entry)).forEach((n) => {
        const b = document.createElement('button');
        b.dataset.act = 'quick';
        b.dataset.n = n;
        b.textContent = n;
        quick.appendChild(b);
    });

    setTarget(it.target);
    $('it-modal').classList.remove('hidden');
}

function closeModal() {
    $('it-modal').classList.add('hidden');
    it.sel = null;
}

function setTarget(target) {
    it.target = target;
    document.querySelector('[data-act="target-self"]').classList.toggle('on', target === 'self');
    document.querySelector('[data-act="target-player"]').classList.toggle('on', target === 'player');
    $('m-players').classList.toggle('hidden', target !== 'player');
    if (target === 'player') renderPlayers();
    updateGive();
}

function renderPlayers() {
    const q = norm($('m-player-search').value.trim());
    const list = $('m-player-list');
    list.innerHTML = '';
    const players = it.players.filter((p) => !q || String(p.id) === q || norm(p.name).includes(q) || norm(p.steam).includes(q));
    if (!players.length) {
        list.innerHTML = `<div class="it-player-empty">${t('no_players')}</div>`;
        return;
    }
    players.forEach((p) => {
        const row = document.createElement('button');
        row.className = 'it-player' + (it.player === p.id ? ' on' : '');
        row.dataset.player = p.id;
        const id = document.createElement('b');
        id.textContent = p.id;
        const name = document.createElement('span');
        name.textContent = p.name;
        const steam = document.createElement('small');
        steam.textContent = p.steam && p.steam !== p.name ? p.steam : '';
        row.append(id, name, steam);
        list.appendChild(row);
    });
}

function amount() {
    const n = Math.floor(Number($('m-amount').value) || 0);
    return Math.max(1, Math.min(n, maxFor(it.sel)));
}

function updateGive() {
    $('m-give').disabled = it.target === 'player' && !it.players.some((p) => p.id === it.player);
}

function give() {
    if (!it.sel) return;
    const target = it.target === 'self' ? 'self' : it.player;
    if (target == null) return;
    post('items:give', { name: it.sel.name, kind: it.sel.kind, target, amount: amount() });
    closeModal();
}

/* events */
document.addEventListener('click', (ev) => {
    const tab = ev.target.closest('[data-cat]');
    if (tab) {
        it.cat = tab.dataset.cat;
        renderTabs();
        filter();
        return;
    }
    const card = ev.target.closest('.it-item');
    if (card) return openModal(it.list[Number(card.dataset.idx)]);

    const row = ev.target.closest('[data-player]');
    if (row) {
        it.player = Number(row.dataset.player);
        renderPlayers();
        updateGive();
        return;
    }

    const btn = ev.target.closest('[data-act]');
    if (!btn) {
        if (ev.target.id === 'it-modal') closeModal();
        return;
    }
    switch (btn.dataset.act) {
        case 'close': return itemsClose();
        case 'cancel': return closeModal();
        case 'give': return give();
        case 'target-self': return setTarget('self');
        case 'target-player': return setTarget('player');
        case 'minus': $('m-amount').value = Math.max(1, amount() - 1); return;
        case 'plus': $('m-amount').value = Math.min(maxFor(it.sel), amount() + 1); return;
        case 'quick': $('m-amount').value = btn.dataset.n; return;
        default:
    }
});

$('it-search').addEventListener('input', (ev) => { it.query = ev.target.value; filter(); });
$('m-player-search').addEventListener('input', renderPlayers);
$('m-amount').addEventListener('change', () => { $('m-amount').value = amount(); });

document.addEventListener('keydown', (ev) => {
    if ($('items').classList.contains('hidden')) return;
    if (ev.key === 'Escape') {
        if (!$('it-modal').classList.contains('hidden')) closeModal(); else itemsClose();
    } else if (ev.key === 'Enter' && !$('it-modal').classList.contains('hidden') && !$('m-give').disabled) {
        give();
    }
});

/* ================================================================ theme
   Config.Theme: scale multiplies the base unit, colors override the tokens of theme.css
   (paper2 -> --paper-2, gold2 -> --gold-2). */
function applyTheme(theme) {
    const root = document.documentElement.style;
    if (typeof FKS !== 'undefined' && theme.position) FKS.THEME.position = theme.position;
    const scale = Number(theme.scale);
    if (scale > 0) root.setProperty('--scale', scale);
    Object.entries(theme.colors || {}).forEach(([key, value]) => {
        if (typeof value === 'string' && value) root.setProperty(`--${key.replace(/(\d+)$/, '-$1')}`, value);
    });
}

/* ================================================================ messages from Lua */
const handlers = {
    init(d) {
        applyTheme(d.theme || {});
        L = d.locale || {};
        cfg.notify = { ...cfg.notify, ...(d.notify || {}) };
        cfg.progress = { ...cfg.progress, ...(d.progress || {}) };
        notifyBox.className = cfg.notify.position || 'top-right';
        applyLocale();
    },
    notify,
    progress: progressStart,
    progressEnd,
    'items:open': itemsOpen,
};

window.addEventListener('message', (ev) => {
    const msg = ev.data || {};
    const fn = handlers[msg.action];
    if (fn) logoReady.then(() => fn(msg.data || {}));
});

logoReady.then(() => post('ready'));
