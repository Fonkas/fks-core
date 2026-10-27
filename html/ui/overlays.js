'use strict';

/* =====================================================================
   Everything around the panel: modal (confirm / prompt), toasts, loading, camera stage and rail,
   cinematic bars, subtitles, the big "choose" picker and the corner caption.
   ===================================================================== */
(() => {
    const { el, icon, arr, txt } = FKS;
    const $ = (id) => document.getElementById(id);
    const typing = (e) => /^(INPUT|TEXTAREA|SELECT)$/.test((e.target && e.target.tagName) || '');

    function hints(node, list) {
        node.innerHTML = '';
        arr(list).forEach((h) => {
            const pair = arr(h);
            const row = el('span', 'hint');
            row.append(el('kbd', '', pair[0]), ` ${txt(pair[1])}`);
            node.appendChild(row);
        });
        node.classList.toggle('hidden', !node.children.length);
    }

    /* ------------------------------------------------------------------ modal */
    FKS.modal = (() => {
        const box = $('ui-modal');
        const title = $('ui-modal-title');
        const body = $('ui-modal-body');
        const ok = $('ui-modal-ok');
        const cancel = $('ui-modal-cancel');
        let cur = null;     // { resolve, o, values }

        const norm = (s) => txt(s).trim().replace(/\s+/g, ' ').toLowerCase();
        const fieldsOf = (o) => arr(o.fields);
        function valid() {
            if (!cur) return false;
            return fieldsOf(cur.o).every((f) => {
                const v = cur.values[f.name];
                if (f.required && (v === undefined || v === null || txt(v).trim() === '')) return false;
                if (f.pattern && !new RegExp(f.pattern, 'i').test(txt(v))) return false;
                if (f.match !== undefined && norm(v) !== norm(f.match)) return false;
                return true;
            });
        }
        const refresh = () => { ok.disabled = !valid(); };

        // fields inside the modal keep their own values, not the page's
        const modalCtx = () => ({
            ...ctx,
            value: (name, fallback) => {
                if (!name) return fallback;
                if (!(name in cur.values)) cur.values[name] = fallback;
                return cur.values[name];
            },
            setValue: (name, v) => { if (name) cur.values[name] = v; refresh(); },
            error: () => null,
            register: () => {},
            emit: () => Promise.resolve(null),
        });

        function open(o) {
            if (cur) finish(false);
            return new Promise((resolve) => {
                cur = { resolve, o, values: {} };
                title.textContent = txt(o.title);
                body.innerHTML = '';
                if (o.text) {
                    const p = el('p');
                    FKS.rich(p, txt(o.text));
                    body.appendChild(p);
                }
                if (o.copy) body.appendChild(el('span', 'store', o.copy));
                if (o.note) body.appendChild(el('p', 'note', o.note));
                const fields = fieldsOf(o);
                if (fields.length) {
                    const wrap = el('div', fields.length > 1 && o.cols !== 1 ? 'ui-grid' : 'ui-fields');
                    if (fields.length > 1 && o.cols !== 1) wrap.style.gridTemplateColumns = `repeat(${o.cols || 2}, minmax(0, 1fr))`;
                    FKS.renderList(fields.map((f) => ({ type: 'input', ...f })), wrap, modalCtx());
                    body.appendChild(wrap);
                }
                ok.textContent = txt(o.ok || FKS.tr('ui_confirm'));
                cancel.textContent = txt(o.cancel || FKS.tr('cancel'));
                cancel.classList.toggle('hidden', o.cancel === false);
                ok.classList.toggle('danger', !!o.danger);
                box.classList.remove('hidden');
                refresh();
                const first = body.querySelector('input, textarea, select');
                if (first) setTimeout(() => first.focus(), 30);
            });
        }

        function finish(accepted) {
            if (!cur) return;
            const c = cur;
            cur = null;
            box.classList.add('hidden');
            c.resolve({ ok: accepted, values: accepted ? { ...c.values } : null });
        }

        ok.addEventListener('click', () => { if (valid()) finish(true); });
        cancel.addEventListener('click', () => finish(false));
        document.addEventListener('keydown', (e) => {
            if (!cur) return;
            if (e.key === 'Escape') { e.preventDefault(); finish(false); }
            else if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA' && valid()) { e.preventDefault(); finish(true); }
        });

        // inside the panel when it is open, centered on screen otherwise
        function attach(inPanel) {
            const panel = $('ui-panel');
            if (inPanel && box.parentElement !== panel) panel.appendChild(box);
            if (!inPanel && box.parentElement !== document.body) document.body.appendChild(box);
            box.classList.toggle('alone', !inPanel);
        }

        // dialogs opened from Lua (UIConfirm / UIPrompt) answer through the ui:modal callback
        async function fromLua(d) {
            if (d.kind === 'close') { if (cur && cur.luaId === d.id) finish(false); return; }
            attach(FKS.isOpen());
            const p = open(d);
            cur.luaId = d.id;
            const r = await p;
            FKS.call('ui:modal', { id: d.id, ok: r.ok, values: r.values });
        }

        return {
            open,
            confirm: (o) => open({ ...o, fields: [] }).then((r) => r.ok),
            prompt: (o) => open(o || {}).then((r) => (r.ok ? r.values : null)),
            close: () => finish(false),
            isOpen: () => !!cur,
            attach,
            fromLua,
        };
    })();

    /* ------------------------------------------------------------------ toasts */
    const toastBox = $('ui-toasts');
    FKS.toast = (text, type = 'inform') => {
        if (!text) return;
        const n = el('div', `toast ${type}`, text);
        toastBox.appendChild(n);
        setTimeout(() => { n.classList.add('out'); setTimeout(() => n.remove(), 300); }, 3500);
    };

    /* ------------------------------------------------------------------ loading */
    function loading(d) {
        $('ui-loading').classList.toggle('hidden', !d.on);
        $('ui-loading-text').textContent = txt(d.text || (d.on ? FKS.tr('ui_loading') : ''));
    }

    /* ------------------------------------------------------------------ camera stage + rail */
    FKS.camera = (() => {
        const stage = $('ui-stage');
        const rail = $('ui-cam');
        const presets = $('ui-cam-presets');
        const tools = $('ui-cam-tools');
        const camHints = $('ui-cam-hints');
        let cfg = null;
        let drag = null;
        let pend = { dx: 0, dy: 0 }, raf = null;

        const active = () => !!(cfg && (cfg.drag !== false || cfg.wheel !== false));
        const send = (data) => FKS.emit('camera', data);

        const TOOLS = [
            ['rotate', -1, 'rotl'], ['rotate', 1, 'rotr'],
            ['zoom', -1, 'plus'], ['zoom', 1, 'minus'],
            ['lift', 1, 'up'], ['lift', -1, 'down'],
            ['pan', -1, 'panl'], ['pan', 1, 'panr'],
            ['reset', 0, 'reset'],
        ];

        function drawRail() {
            const r = cfg && cfg.rail;
            rail.classList.toggle('hidden', !r);
            if (!r) return;
            presets.innerHTML = '';
            arr(r.presets).forEach((pr) => {
                const b = el('button', `chip${pr.id === r.preset ? ' on' : ''}`, pr.label);
                b.addEventListener('click', () => {
                    r.preset = pr.id;
                    drawRail();
                    send({ kind: 'preset', value: pr.id, source: 'button' });
                });
                presets.appendChild(b);
            });
            tools.innerHTML = '';
            if (r.tools !== false) {
                TOOLS.forEach(([kind, value, ic]) => {
                    const b = el('button', 'back');
                    b.appendChild(icon(ic, ''));
                    b.addEventListener('click', () => send({ kind, value, source: 'button' }));
                    tools.appendChild(b);
                });
            }
            hints(camHints, r.hints);
        }

        function set(c) {
            cfg = c && typeof c === 'object' ? c : null;
            stage.classList.toggle('on', active() && FKS.isOpen() && !FKS.S.hidden && !FKS.S.suspended);
            drawRail();
        }

        const flush = () => {
            raf = null;
            if (pend.dx || pend.dy) send({ kind: 'drag', dx: pend.dx, dy: pend.dy });
            pend = { dx: 0, dy: 0 };
        };
        stage.addEventListener('mousedown', (e) => {
            if (!cfg || cfg.drag === false || e.button !== 0) return;
            drag = { x: e.clientX, y: e.clientY };
            stage.classList.add('drag');
        });
        window.addEventListener('mousemove', (e) => {
            if (!drag) return;
            pend.dx += e.clientX - drag.x;
            pend.dy += e.clientY - drag.y;
            drag = { x: e.clientX, y: e.clientY };
            if (!raf) raf = requestAnimationFrame(flush);
        });
        window.addEventListener('mouseup', () => { drag = null; stage.classList.remove('drag'); });
        stage.addEventListener('wheel', (e) => {
            if (!cfg || cfg.wheel === false) return;
            FKS.throttle('cam:wheel', () => send({ kind: 'wheel', value: e.deltaY > 0 ? 1 : -1 }), 50);
        }, { passive: true });

        const KEYS = {
            a: ['rotate', -1], d: ['rotate', 1], arrowleft: ['rotate', -1], arrowright: ['rotate', 1],
            w: ['zoom', -1], s: ['zoom', 1], e: ['lift', 1], q: ['lift', -1], arrowup: ['lift', 1], arrowdown: ['lift', -1],
            z: ['pan', -1], c: ['pan', 1],
        };
        document.addEventListener('keydown', (e) => {
            if (!cfg || !cfg.keys || typing(e) || FKS.modal.isOpen() || !FKS.isOpen() || FKS.S.hidden || FKS.S.suspended) return;
            if (FKS.S.keys[e.key]) return;               // the page uses this key (carousel arrows)
            const k = KEYS[e.key.toLowerCase()];
            if (k) send({ kind: k[0], value: k[1], source: 'key' });
        });

        return { set, active };
    })();

    /* ------------------------------------------------------------------ cinematic bars + title card */
    function cinematic(d) {
        const box = $('ui-cine');
        const card = $('ui-cine-card');
        if (!d.on) { box.classList.add('hidden'); card.classList.add('hidden'); return; }
        const first = box.classList.contains('hidden');
        box.classList.remove('hidden');
        box.classList.toggle('no-bars', d.bars === false);
        if (first || d.skip !== undefined) {
            const skip = $('ui-cine-skip');
            skip.innerHTML = '';
            if (d.skip) skip.append(el('kbd', '', d.skipKey || 'ENTER'), ` ${txt(d.skip)}`);
        }
        if (d.title) {
            $('ui-cine-title').textContent = d.title;
            $('ui-cine-sub').textContent = txt(d.sub);
            card.classList.remove('hidden', 'out');
        } else if (!card.classList.contains('hidden')) {
            card.classList.add('out');
        }
    }

    /* ------------------------------------------------------------------ subtitle */
    let subTimer = null;
    function subtitle(d) {
        const box = $('ui-subtitle');
        clearTimeout(subTimer);
        if (!d.text) { box.classList.add('hidden'); return; }
        $('ui-subtitle-text').textContent = d.text;
        box.classList.add('hidden');
        void box.offsetWidth;
        box.classList.remove('hidden');
        if (d.ms) subTimer = setTimeout(() => box.classList.add('hidden'), d.ms);
    }

    /* ------------------------------------------------------------------ choose (big options at the bottom) */
    const choose = (() => {
        const box = $('ui-choose');
        const opts = $('ui-choose-opts');
        let st = null;  // { options, value, cancel }

        const paint = () => [...opts.children].forEach((n) => n.classList.toggle('on', n.dataset.i === String(st.options.findIndex((o) => o.value === st.value))));
        const change = (v) => {
            if (!st || v === st.value) return;
            st.value = v;
            paint();
            FKS.call('ui:choose', { value: v });
        };
        const done = (v) => {
            if (!st) return;
            st = null;
            FKS.call('ui:choose', { done: true, value: v });
        };

        function show(d) {
            if (!d.on) { st = null; box.classList.add('hidden'); return; }
            st = { options: arr(d.options), value: d.selected, cancel: !!d.cancel };
            opts.innerHTML = '';
            st.options.forEach((o, i) => {
                const n = el('span');
                n.dataset.i = i;
                if (o.icon) n.appendChild(icon(o.icon));
                n.appendChild(el('b', '', o.label));
                n.addEventListener('mouseenter', () => change(o.value));
                n.addEventListener('click', () => { change(o.value); done(o.value); });
                opts.appendChild(n);
            });
            hints($('ui-choose-hints'), d.hints);
            box.classList.remove('hidden');
            paint();
        }

        document.addEventListener('keydown', (e) => {
            if (!st) return;
            const k = e.key.toLowerCase();
            if (k === 'tab' || k === 'arrowright' || k === 'd' || k === 'arrowleft' || k === 'a') {
                e.preventDefault();
                const step = k === 'arrowleft' || k === 'a' ? -1 : 1;
                const i = st.options.findIndex((o) => o.value === st.value);
                const next = st.options[(i + step + st.options.length) % st.options.length];
                if (next) change(next.value);
            } else if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                if (st.value !== undefined && st.value !== null) done(st.value);
            } else if (e.key === 'Escape' && st.cancel) {
                done(null);
            }
        });
        return show;
    })();

    /* ------------------------------------------------------------------ caption (corner prompt with countdown) */
    let capTimer = null;
    function caption(d) {
        const box = $('ui-caption');
        clearInterval(capTimer);
        if (!d.on) { box.classList.add('hidden'); return; }
        $('ui-caption-text').textContent = txt(d.text);
        const h = $('ui-caption-hints');
        hints(h, d.hints);
        if (d.seconds) {
            const count = el('span', 'count');
            h.appendChild(count);
            h.classList.remove('hidden');
            let left = Number(d.seconds);
            const tick = () => { count.textContent = ` · ${left}s`; left = Math.max(0, left - 1); };
            tick();
            capTimer = setInterval(tick, 1000);
        }
        box.classList.remove('hidden');
    }

    /* ------------------------------------------------------------------ tracker (small top-centre timer + bar) */
    let trEnd = 0, trTimer = null;
    function tracker(d) {
        const box = $('ui-tracker');
        if (!d.on) { box.classList.add('hidden'); clearInterval(trTimer); trTimer = null; return; }
        $('ui-tracker-label').textContent = txt(d.label);
        const time = $('ui-tracker-time');
        const hasTime = d.seconds !== undefined && d.seconds !== null;
        if (hasTime) {
            trEnd = Date.now() + Number(d.seconds) * 1000;
            const tick = () => {
                const s = Math.max(0, Math.round((trEnd - Date.now()) / 1000));
                time.textContent = `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
                time.classList.toggle('low', s <= 60);
            };
            tick();
            if (!trTimer) trTimer = setInterval(tick, 1000);
        }
        time.classList.toggle('hidden', !hasTime);
        const bar = $('ui-tracker-bar');
        if (d.bar) {
            const v = Math.max(0, Math.min(1, Number(d.bar.value) || 0));
            bar.className = `tr-bar ${d.bar.tone || ''}`;
            bar.querySelector('i').style.width = `${v * 100}%`;
            bar.querySelector('span').textContent = `${txt(d.bar.label)} ${Math.round(v * 100)}%`;
        } else {
            bar.className = 'tr-bar hidden';
        }
        box.classList.remove('hidden');
    }

    /* ------------------------------------------------------------------ sheet (side card without focus) */
    const sheet = (() => {
        const box = $('ui-sheet');
        let cur = null;     // { owner, id }
        const sheetCtx = { ...ctx, register: () => {}, emit: () => Promise.resolve(null), fire: () => Promise.resolve(null), key: () => {} };

        function show(d) {
            if (!d.on) {
                if (!cur || ((!d.owner || d.owner === cur.owner) && (d.id === undefined || d.id === null || d.id === false || d.id === cur.id))) {
                    cur = null;
                    box.classList.add('hidden');
                }
                return;
            }
            const v = d.view || {};
            const again = cur && cur.owner === d.owner && cur.id === d.id && !box.classList.contains('hidden');
            cur = { owner: d.owner, id: d.id };
            box.innerHTML = '';
            box.dataset.position = v.position || 'right';
            const head = el('header', 'ui-head');
            if (v.eyebrow) head.appendChild(el('div', 'eyebrow', v.eyebrow));
            head.appendChild(el('h1', '', v.title));
            box.appendChild(head);
            if (v.subtitle) box.appendChild(el('div', 'ui-text sub', v.subtitle));
            const body = el('div', 'sheet-body');
            FKS.renderList(v.body, body, sheetCtx);
            box.appendChild(body);
            if (arr(v.hints).length) {
                const foot = el('div', 'hints sheet-foot');
                hints(foot, v.hints);
                box.appendChild(foot);
            }
            if (!again) {
                box.style.animation = 'none';
                void box.offsetWidth;
                box.style.animation = '';
            }
            box.classList.remove('hidden');
        }
        return show;
    })();

    /* ------------------------------------------------------------------ pick (dots over world positions) */
    const pick = (() => {
        const box = $('ui-pick');
        const hint = $('ui-pick-hint');
        const dots = new Map();
        let on = false;
        const done = (value) => { if (on) FKS.call('ui:block', { kind: 'pick', done: true, value }); };

        function show(d) {
            on = !!d.on;
            box.classList.toggle('hidden', !on);
            if (!on) { dots.forEach((n) => n.remove()); dots.clear(); return; }
            hint.textContent = txt(d.hint);
            hint.classList.toggle('hidden', !d.hint);
            const seen = new Set();
            arr(d.dots).forEach((p) => {
                const id = String(p.id);
                seen.add(id);
                let n = dots.get(id);
                if (!n) {
                    n = el('button', 'pick-dot');
                    n.dataset.id = id;
                    n.appendChild(el('span'));
                    n.addEventListener('click', () => done(p.id));
                    box.appendChild(n);
                    dots.set(id, n);
                }
                n.style.left = `${(Number(p.x) * 100).toFixed(3)}%`;
                n.style.top = `${(Number(p.y) * 100).toFixed(3)}%`;
                n.firstChild.textContent = txt(p.label);
            });
            dots.forEach((n, id) => { if (!seen.has(id)) { n.remove(); dots.delete(id); } });
        }
        box.addEventListener('contextmenu', (e) => { e.preventDefault(); done(null); });
        document.addEventListener('keydown', (e) => {
            if (on && (e.key === 'Escape' || e.key === 'Backspace')) { e.preventDefault(); done(null); }
        });
        return show;
    })();

    /* ------------------------------------------------------------------ minigame 'keys' (falling letters) */
    const minigame = (() => {
        const box = $('ui-minigame');
        const G = { on: false, items: [], raf: 0, cfg: null };

        const clear = () => { G.on = false; cancelAnimationFrame(G.raf); G.items = []; box.innerHTML = ''; };
        const hide = () => { clear(); box.classList.add('hidden'); };
        function end(ok) {
            if (!G.on) return;
            G.on = false;
            cancelAnimationFrame(G.raf);
            if (ok) G.items.forEach((it) => it.el.classList.add('hit'));   // time is up: the rest vanish
            FKS.call('ui:block', { kind: 'minigame', done: true, value: ok });
            setTimeout(hide, ok ? 400 : 700);
        }
        function spawn(now) {
            const letters = String(G.cfg.letters || 'ASDQWEZXC');
            const letter = letters[Math.floor(Math.random() * letters.length)].toUpperCase();
            const n = el('div', 'mg-key', letter);
            n.style.left = `${5 + Math.random() * 90}%`;
            box.appendChild(n);
            const it = { el: n, letter, t0: now };
            n.addEventListener('pointerdown', (e) => { e.preventDefault(); hit(it); });
            G.items.push(it);
        }
        function hit(it) {
            if (!G.on || !G.items.includes(it)) return;
            G.items = G.items.filter((x) => x !== it);
            it.el.classList.add('hit');
            setTimeout(() => it.el.remove(), 220);
        }
        function tick(now) {
            if (!G.on) return;
            const c = G.cfg, elapsed = now - G.start;
            if (elapsed >= c.duration) return end(true);
            if (now >= G.next) {
                spawn(now);
                const k = elapsed / c.duration;
                G.next = now + c.spawnEvery + (c.spawnEveryEnd - c.spawnEvery) * k;
            }
            const H = window.innerHeight;
            for (const it of G.items) {
                const p = (now - it.t0) / c.fallTime;
                it.el.style.transform = `translateY(${(p * (H - it.el.offsetHeight)).toFixed(1)}px)`;
                if (p >= 1) { it.el.classList.add('miss'); return end(false); }   // one got away
            }
            G.raf = requestAnimationFrame(tick);
        }
        function show(d) {
            if (!d.on) { hide(); return; }
            clear();
            G.cfg = {
                duration: Number(d.duration) || 15000, fallTime: Number(d.fallTime) || 3000,
                spawnEvery: Number(d.spawnEvery) || 900, spawnEveryEnd: Number(d.spawnEveryEnd) || Number(d.spawnEvery) || 500,
                letters: d.letters,
            };
            box.classList.remove('hidden');
            G.on = true;
            G.start = performance.now();
            G.next = 0;
            G.raf = requestAnimationFrame(tick);
        }
        document.addEventListener('keydown', (e) => {
            if (!G.on) return;
            e.preventDefault();
            const k = (e.key || '').toUpperCase();
            if (k.length !== 1) return;
            const it = G.items.filter((x) => x.letter === k).sort((a, b) => a.t0 - b.t0)[0];   // oldest = lowest
            if (it) hit(it);
        });
        return show;
    })();

    /* ------------------------------------------------------------------ wire everything to the message handlers of app.js */
    FKS.mount();
    Object.assign(handlers, FKS.messages, {
        'ui:modal': FKS.modal.fromLua,
        'ui:toast': (d) => FKS.toast(d.text, d.type),
        'ui:loading': loading,
        'ui:cinematic': cinematic,
        'ui:subtitle': subtitle,
        'ui:choose': choose,
        'ui:caption': caption,
        'ui:tracker': tracker,
        'ui:sheet': sheet,
        'ui:pick': pick,
        'ui:minigame': minigame,
    });

    // browser dev mode (html/dev is not shipped in game)
    if (!IN_GAME) {
        const s = document.createElement('script');
        s.src = 'dev/dev.js';
        document.body.appendChild(s);
    }
})();
