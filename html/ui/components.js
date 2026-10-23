'use strict';

/* =====================================================================
   Built-in components. Each one: render(props, ctx) -> Element, optional update(el, props, ctx).
   Form fields read/write through ctx.value / ctx.setValue so the same component works in a page
   (view values) and inside a prompt modal (its own values).
   Catalog and props: docs/UI-API.md section 6
   ===================================================================== */
(() => {
    const { el, icon, arr, txt } = FKS;
    const C = FKS.component;
    const num = (v, d = 0) => (Number.isFinite(Number(v)) ? Number(v) : d);

    // label + control + note / counter + error line, shared by every form field
    function field(p, c, control) {
        if (!p.label && !p.note && !p.name) return control;
        const f = el('div', 'field');
        if (p.name) f.dataset.field = p.name;
        if (p.label) {
            const lab = el('label', '', p.label);
            if (p.optional) lab.appendChild(el('small', '', ` (${c.t('ui_optional')})`));
            f.appendChild(lab);
        }
        f.appendChild(control);
        if (p.note) f.appendChild(el('div', 'note', p.note));
        const err = el('div', 'err');
        const msg = p.name && c.error(p.name);
        if (msg) { err.textContent = msg; f.classList.add('invalid'); }
        f.appendChild(err);
        return f;
    }

    // runs the field's action when its value changes (live = while typing, throttled)
    function changed(p, c, v, live) {
        if (!p.action) return;
        const send = () => c.emit(p.action, { name: p.name, id: p.id, value: v });
        if (live) c.throttle(`field:${p.name || p.id}`, send, num(p.throttle, 150));
        else send();
    }

    /* ------------------------------------------------------------------ layout and text */
    C('section', { render: (p) => el('div', 'section-label', p.label) });

    C('text', {
        render(p) {
            const n = el('p', `ui-text ${p.style || 'desc'}`);
            rich(n, txt(p.text));
            return n;
        },
    });

    // **bold** inside texts, everything else stays plain text
    function rich(node, s) {
        s.split(/\*\*(.+?)\*\*/g).forEach((part, i) => node.append(i % 2 ? el('strong', '', part) : part));
    }
    FKS.rich = rich;

    C('empty', {
        render(p, c) {
            const n = el('div', 'ui-empty', p.text);
            if (p.button) {
                const b = c.renderNode({ type: 'button', ...p.button });
                if (b) n.appendChild(b);
            }
            return n;
        },
    });

    C('row', {
        render(p, c) {
            const n = el('div', `ui-row${p.align === 'center' ? ' center' : ''}`);
            if (p.gap !== undefined) n.style.gap = `calc(${num(p.gap)} * var(--u))`;
            if (p.align) n.style.justifyContent = p.align;
            return c.renderList(p.children, n, c);
        },
    });

    C('grid', {
        render(p, c) {
            const n = el('div', 'ui-grid');
            n.style.gridTemplateColumns = p.template || `repeat(${num(p.cols, 2)}, minmax(0, 1fr))`;
            if (p.gap !== undefined) n.style.gap = `calc(${num(p.gap)} * var(--u))`;
            return c.renderList(p.children, n, c);
        },
    });

    C('kv', {
        render(p) {
            const n = el('dl', 'kv');
            n.style.gridTemplateColumns = `repeat(${num(p.cols, 2)}, minmax(0, 1fr))`;
            arr(p.items).forEach((it) => {
                const d = el('div');
                if (it.rating !== undefined) {
                    // icons on / off (horse bond: 3 of 4 horseshoes)
                    const dd = el('dd', 'rating');
                    for (let i = 1; i <= num(it.max, 5); i += 1) dd.appendChild(icon(it.icon || 'shoe', i <= num(it.rating) ? 'ico on' : 'ico'));
                    d.append(el('dt', '', it.label), dd);
                    n.appendChild(d);
                    return;
                }
                if (it.value === undefined || it.value === null || it.value === '') return;
                d.append(el('dt', '', it.label), el('dd', it.tone || '', txt(it.value)));
                n.appendChild(d);
            });
            return n;
        },
    });

    C('badges', {
        render(p) {
            const n = el('div', 'badges');
            arr(p.items).forEach((b) => n.appendChild(el('span', `bdg ${b.tone || ''}`, typeof b === 'string' ? b : b.text)));
            return n;
        },
    });

    /* ------------------------------------------------------------------ buttons and choices */
    C('button', {
        render(p, c) {
            const style = p.style && p.style !== 'primary' ? p.style : '';
            const b = el('button', ['btn', style, p.small ? 'small' : '', p.wide ? 'wide' : '', p.pulse ? 'go' : '', (p.icon || p.iconRight) ? 'ico-btn' : ''].filter(Boolean).join(' '));
            if (p.icon) b.appendChild(icon(p.icon));
            b.appendChild(el('span', '', p.label));
            if (p.iconRight) b.appendChild(icon(p.iconRight));
            b.disabled = !!p.disabled;
            if (p.requires) {
                b.dataset.requires = p.requires;
                if (!present(c.value(p.requires))) b.disabled = true;
            }
            b.addEventListener('click', (e) => {
                e.stopPropagation();
                c.fire(p, {}, b);
            });
            return b;
        },
    });
    const present = (v) => v !== undefined && v !== null && v !== '' && v !== false;

    // options in a row: pills (with icons), a 2-way switch, or a list of text choices
    C('segmented', {
        render(p, c) {
            const style = p.style || 'pills';
            const box = el('div', `seg ${style}${p.locked ? ' locked' : ''}`);
            if (style === 'list') box.style.gridTemplateColumns = `repeat(${num(p.cols, 2)}, minmax(0, 1fr))`;
            let cur = p.name ? c.value(p.name, p.value) : p.value;
            const opts = arr(p.options).map((o) => (typeof o === 'object' ? o : { value: o, label: String(o) }));
            const buttons = [];
            const paint = () => buttons.forEach(([b, o]) => b.classList.toggle('on', o.value === cur));
            opts.forEach((o) => {
                if (p.locked && o.value !== cur) return;
                const b = el('button');
                if (o.icon) b.appendChild(icon(o.icon));
                if (o.label) b.appendChild(el('span', '', o.label));
                if (!o.icon) b.classList.add('txt');
                b.disabled = !!(p.disabled || p.locked || o.disabled);
                b.addEventListener('click', async () => {
                    if (o.value === cur || box.classList.contains('busy')) return;
                    const prev = cur;
                    cur = o.value;
                    p.value = cur;
                    if (p.name) c.setValue(p.name, cur);
                    paint();
                    if (p.action) {
                        const res = await c.fire({ action: p.action, value: cur, confirm: p.confirm }, { name: p.name, id: p.id }, box);
                        if (res && res.ok === false) { cur = prev; p.value = prev; if (p.name) c.setValue(p.name, prev); paint(); }
                    }
                });
                buttons.push([b, o]);
                box.appendChild(b);
            });
            paint();
            return field(p, c, box);
        },
    });

    /* ------------------------------------------------------------------ dials (pick one of N) */
    const SVG = (tag, attrs) => {
        const n = document.createElementNS(FKS.NS, tag);
        Object.entries(attrs).forEach(([k, v]) => n.setAttribute(k, v));
        return n;
    };
    function dialSvg() {
        const svg = SVG('svg', { viewBox: '0 0 64 64' });
        const g = SVG('g', { class: 'knob' });
        g.appendChild(SVG('circle', { class: 'a', cx: 32, cy: 32, r: 27 }));
        for (let k = 0; k < 12; k += 1) g.appendChild(SVG('line', { class: 't', x1: 32, y1: 6.5, x2: 32, y2: 9.5, transform: `rotate(${k * 30} 32 32)` }));
        g.appendChild(SVG('line', { class: 'n', x1: 32, y1: 4, x2: 32, y2: 10 }));
        svg.appendChild(g);
        return { svg, knob: g };
    }

    function dial(item, group, c) {
        const tile = el('div', 'tile');
        tile.appendChild(el('label', '', item.label));
        const box = el('div', 'dial');
        const { svg, knob } = dialSvg();
        const numEl = el('b');
        box.append(svg, numEl);
        tile.appendChild(box);
        const row = el('div', 'dial-row');
        const prev = el('button', 'arr');
        prev.appendChild(icon('left', ''));
        const next = el('button', 'arr');
        next.appendChild(icon('right', ''));
        const cap = el('small');
        row.append(prev, cap, next);
        tile.appendChild(row);

        const min = () => (item.min !== undefined ? num(item.min) : (item.none ? 0 : 1));
        const count = () => Math.max(num(item.count, 1), 0);
        const get = () => (item.value === undefined || item.value === null ? min() : num(item.value));
        const update = () => {
            const n = count();
            const v = Math.min(get(), n);
            const zero = v === 0 && item.none;
            knob.style.transform = `rotate(${(v / Math.max(n, 1)) * 330}deg)`;
            numEl.textContent = zero ? '—' : v;
            numEl.classList.toggle('zero', !!zero);
            const named = arr(item.captions)[v - 1];   // captions[1] is the name of value 1 (wagon paints)
            cap.textContent = zero ? txt(item.noneLabel || group.noneLabel || '—') : (named !== undefined ? txt(named) : `${v} / ${n}`);
            const locked = n <= min() || item.disabled;
            box.toggleAttribute('disabled', !!locked);
            prev.disabled = !!locked;
            next.disabled = !!locked;
        };
        const set = (v, immediate) => {
            const n = count();
            if (v > n) v = min();
            if (v < min()) v = n;
            if (v === get()) return;
            item.value = v;
            update();
            const send = () => c.emit(group.action, { id: item.id, value: v });
            if (immediate) send(); else c.throttle(`dial:${item.id}`, send, num(group.throttle, 90));
        };
        prev.addEventListener('click', () => set(get() - 1, true));
        next.addEventListener('click', () => set(get() + 1, true));
        box.addEventListener('wheel', (e) => { e.preventDefault(); set(get() + (e.deltaY > 0 ? 1 : -1), false); });
        // drag on the knob: every ~12px is one step (no wrap-around)
        box.addEventListener('mousedown', (e) => {
            e.preventDefault();
            const start = { x: e.clientX, y: e.clientY, v: get() };
            box.classList.add('drag');
            const move = (ev) => {
                const delta = Math.round(((ev.clientX - start.x) - (ev.clientY - start.y)) / 12);
                const v = Math.max(min(), Math.min(count(), start.v + delta));
                if (v !== get()) set(v, false);
            };
            const up = () => {
                box.classList.remove('drag');
                window.removeEventListener('mousemove', move);
                window.removeEventListener('mouseup', up);
            };
            window.addEventListener('mousemove', move);
            window.addEventListener('mouseup', up);
        });
        c.register(item.id, { el: tile, props: item, update });
        update();
        return tile;
    }

    C('dials', {
        render(p, c) {
            const grid = el('div', 'dials');
            grid.style.gridTemplateColumns = `repeat(${num(p.cols, 3)}, minmax(0, 1fr))`;
            arr(p.items).forEach((it) => grid.appendChild(dial(it, p, c)));
            return grid;
        },
    });

    /* ------------------------------------------------------------------ slider */
    function paintRange(input) {
        const min = num(input.min), max = num(input.max), v = num(input.value);
        const pct = ((v - min) / (max - min || 1)) * 100;
        if (min < 0) {
            input.classList.add('center');
            input.style.setProperty('--a', `${Math.min(pct, 50)}%`);
            input.style.setProperty('--b', `${Math.max(pct, 50)}%`);
        } else {
            input.style.setProperty('--p', `${pct}%`);
        }
    }

    function format(p, v) {
        const suffix = p.suffix ? `${p.suffix}` : '';
        switch (p.format) {
            case 'percent': return `${Math.round(v * 100)}%`;
            case 'signed': return `${v > 0 ? '+' : ''}${v.toFixed(num(p.decimals, 2))}${suffix}`;
            case 'int': return `${Math.round(v)}${suffix}`;
            default: return `${p.decimals !== undefined ? v.toFixed(num(p.decimals)) : v}${suffix}`;
        }
    }

    C('slider', {
        render(p, c) {
            const isField = p.style === 'field';
            const row = el('div', isField ? 'slider-row' : 'stat');
            if (!isField) row.appendChild(el('label', '', p.label));
            const input = el('input');
            input.type = 'range';
            input.min = num(p.min, 0);
            input.max = num(p.max, 1);
            input.step = p.step !== undefined ? p.step : 'any';
            const val = el(isField ? 'b' : 'span', 'val');
            row.append(input, val);
            const start = p.name ? c.value(p.name, num(p.value)) : num(p.value);
            p.value = start;
            const reset = p.reset !== undefined ? p.reset : (num(p.min) <= 0 && num(p.max) >= 0 ? 0 : null);

            const update = () => {
                const v = num(p.value);
                input.value = v;
                paintRange(input);
                val.textContent = format(p, v);
                row.classList.toggle('on', !isField && reset !== null && v !== reset);
            };
            const set = (v, immediate) => {
                p.value = v;
                if (p.name) c.setValue(p.name, v);
                update();
                if (!p.action) return;
                const send = () => c.emit(p.action, { id: p.id, name: p.name, value: v });
                if (immediate) send(); else c.throttle(`slider:${p.id || p.name}`, send, num(p.throttle, 60));
            };
            input.addEventListener('input', () => set(num(input.value), false));
            input.addEventListener('dblclick', () => { if (reset !== null) set(reset, true); });
            if (p.disabled) input.disabled = true;
            if (p.id !== undefined) c.register(p.id, { el: row, props: p, update });
            update();
            return isField ? field({ ...p, id: undefined }, c, row) : row;
        },
    });

    /* ------------------------------------------------------------------ stats (read-only bars, or sliders) */
    C('stats', {
        render(p, c) {
            const box = el('div', 'stats');
            arr(p.rows).forEach((r) => {
                if (r.kind === 'slider') {
                    const s = c.renderNode({ ...r, type: 'slider', action: r.action || p.action }, c);
                    if (s) box.appendChild(s);
                    return;
                }
                const row = el('div', 'stat');
                row.appendChild(el('label', '', r.label));
                if (r.kind === 'bar') {
                    const pct = Math.max(0, Math.min(100, (num(r.value) / num(r.max, 100)) * 100));
                    const bar = el('div', `inkbar ${r.tone || ''} ${pct < 20 ? 'low' : ''}`);
                    const fill = el('i');
                    fill.style.width = `${pct}%`;
                    bar.appendChild(fill);
                    row.appendChild(bar);
                } else {
                    const max = num(r.max, 10);
                    const on = Math.round((num(r.value) / max) * 10);
                    const ticks = el('div', `ticks ${r.tone === 'gold' ? 'gold' : ''}`);
                    for (let i = 0; i < 10; i += 1) ticks.appendChild(el('i', i < on ? 'on' : ''));
                    row.appendChild(ticks);
                }
                row.appendChild(el('span', 'val', txt(r.text !== undefined ? r.text : '')));
                box.appendChild(row);
            });
            return box;
        },
    });

    /* ------------------------------------------------------------------ list (selectable rows that expand) */
    C('list', {
        render(p, c) {
            const box = el('div', 'ui-list');
            const draw = () => {
                box.innerHTML = '';
                const items = arr(p.items);
                if (p.selected === undefined && items.length) {
                    const first = items.find((it) => !it.variant);
                    if (first) p.selected = first.value;
                }
                items.forEach((it) => box.appendChild(row(it)));
            };
            const row = (it) => {
                const sel = !it.variant && it.value === p.selected;
                const r = el('div', `ui-item${sel ? ' on' : ''}${it.variant ? ` ${it.variant}` : ''}`);
                if (it.variant || it.icon) {
                    r.appendChild(icon(it.icon || (it.variant === 'locked' ? 'lock' : 'plus-c'), 'ico lead'));
                }
                const main = el('div', 'ui-item-main');
                const top = el('div', 'row');
                const name = el('span', 'name', it.title);
                if (it.flag) {
                    const f = typeof it.flag === 'object' ? it.flag : { text: it.flag };
                    name.appendChild(el('span', `flag ${f.tone || 'bad'}`, f.text));
                }
                top.appendChild(name);
                if (it.tag !== undefined && it.tag !== null) top.appendChild(el('span', 'tag', txt(it.tag)));
                main.appendChild(top);
                if (it.sub) main.appendChild(el('div', 'sub', it.sub));

                const expand = p.expand === 'all' || (p.expand !== 'none' && sel);
                if (expand && !it.variant && (arr(it.details).length || arr(it.actions).length)) {
                    const more = el('div', 'more');
                    c.renderList(it.details, more, c);
                    if (arr(it.actions).length) {
                        const acts = el('div', 'acts');
                        arr(it.actions).forEach((a) => {
                            const b = c.renderNode({ type: 'button', ...a, value: a.value !== undefined ? a.value : it.value }, c);
                            if (b) acts.appendChild(b);
                        });
                        more.appendChild(acts);
                    }
                    main.appendChild(more);
                }
                r.appendChild(main);

                r.addEventListener('click', async () => {
                    if (box.classList.contains('busy')) return;
                    if (it.variant || it.action || it.prompt || it.confirm || it.go) {
                        c.fire(it, { id: p.id }, box);
                        return;
                    }
                    if (it.value === p.selected) return;
                    p.selected = it.value;
                    if (p.name) c.setValue(p.name, it.value);
                    draw();
                    if (p.action) c.emit(p.action, { id: p.id, value: it.value });
                });
                return r;
            };
            if (p.name && p.selected !== undefined) c.value(p.name, p.selected);
            draw();
            if (p.id !== undefined) c.register(p.id, { el: box, props: p, update: draw });
            return box;
        },
    });

    /* ------------------------------------------------------------------ cards (big pickable cards) */
    C('cards', {
        render(p, c) {
            const grid = el('div', 'ui-cards');
            grid.style.gridTemplateColumns = p.cols ? `repeat(${num(p.cols)}, minmax(0, 1fr))` : 'repeat(auto-fit, minmax(calc(30 * var(--u)), 1fr))';
            let cur = p.name ? c.value(p.name, p.selected) : p.selected;
            const cards = [];
            const paint = () => cards.forEach(([n, it]) => n.classList.toggle('on', it.value === cur));
            arr(p.items).forEach((it, idx) => {
                const card = el('button', 'ui-card');
                card.style.animationDelay = `${idx * 60}ms`;
                card.disabled = !!it.disabled;
                card.appendChild(el('span', 'tick'));
                if (it.img) {
                    const im = el('img', 'card-img');
                    im.src = it.img;
                    im.onerror = () => { im.style.visibility = 'hidden'; };
                    card.appendChild(im);
                }
                card.appendChild(el('h3', '', it.title));
                if (it.text) card.appendChild(el('p', 'card-text', it.text));
                const lines = arr(it.lines);
                if (lines.length) {
                    const ul = el('ul');
                    lines.forEach((ln) => {
                        const li = el('li');
                        if (ln.img) {
                            const im = el('img');
                            im.src = ln.img;
                            im.onerror = () => { im.style.visibility = 'hidden'; };
                            li.appendChild(im);
                        }
                        if (ln.amount !== undefined) li.appendChild(el('b', '', `${ln.amount}x`));
                        li.append(txt(ln.label));
                        ul.appendChild(li);
                    });
                    card.appendChild(ul);
                }
                card.addEventListener('click', () => {
                    if (cur === it.value) return;
                    cur = it.value;
                    p.selected = cur;
                    if (p.name) c.setValue(p.name, cur);
                    paint();
                    if (p.action) c.emit(p.action, { id: p.id, value: cur });
                });
                if (p.submit) {
                    card.addEventListener('dblclick', () => {
                        cur = it.value;
                        if (p.name) c.setValue(p.name, cur);
                        paint();
                        c.fire(p.submit, {}, grid);
                    });
                }
                cards.push([card, it]);
                grid.appendChild(card);
            });
            paint();
            return grid;
        },
    });

    /* ------------------------------------------------------------------ form fields */
    function textField(p, c, multiline) {
        const input = el(multiline ? 'textarea' : 'input');
        if (!multiline) input.type = 'text';
        if (p.max) input.maxLength = num(p.max);
        if (p.placeholder) input.placeholder = p.placeholder;
        input.value = txt(p.name ? c.value(p.name, txt(p.value)) : p.value);
        input.disabled = !!p.disabled;
        input.spellcheck = false;
        let counter = null;
        if (multiline && p.max) counter = el('div', 'counter', `${input.value.length} / ${p.max}`);
        input.addEventListener('input', () => {
            if (p.name) c.setValue(p.name, input.value);
            if (counter) counter.textContent = `${input.value.length} / ${p.max}`;
            if (p.live) changed(p, c, input.value, true);
        });
        if (!p.live) input.addEventListener('change', () => changed(p, c, input.value, false));
        const f = field(p, c, input);
        if (counter && f !== input) f.insertBefore(counter, f.querySelector('.err'));
        return f;
    }
    C('input', { render: (p, c) => textField(p, c, false) });
    C('textarea', { render: (p, c) => textField(p, c, true) });

    C('select', {
        render(p, c) {
            const s = el('select');
            arr(p.options).forEach((o) => {
                const opt = typeof o === 'object' ? o : { value: o, label: String(o) };
                const n = el('option', '', opt.label);
                n.value = opt.value;
                s.appendChild(n);
            });
            const start = p.name ? c.value(p.name, p.value) : p.value;
            if (start !== undefined) s.value = start;
            s.disabled = !!p.disabled;
            s.addEventListener('change', () => {
                const opt = arr(p.options).map((o) => (typeof o === 'object' ? o : { value: o })).find((o) => String(o.value) === s.value);
                const v = opt ? opt.value : s.value;
                if (p.name) c.setValue(p.name, v);
                changed(p, c, v, false);
            });
            return field(p, c, s);
        },
    });

    C('number', {
        render(p, c) {
            const min = num(p.min, -Infinity), max = num(p.max, Infinity), step = num(p.step, 1);
            const box = el('div', 'ui-amount');
            const minus = el('button', '', '−');
            const input = el('input');
            input.type = 'number';
            const plus = el('button', '', '+');
            box.append(minus, input, plus);
            const clamp = (v) => Math.max(min, Math.min(max, num(v, Number.isFinite(min) ? min : 0)));
            input.value = clamp(p.name ? c.value(p.name, clamp(p.value)) : p.value);
            const set = (v) => {
                v = clamp(v);
                input.value = v;
                if (p.name) c.setValue(p.name, v);
                changed(p, c, v, true);
            };
            minus.addEventListener('click', () => set(num(input.value) - step));
            plus.addEventListener('click', () => set(num(input.value) + step));
            input.addEventListener('change', () => set(input.value));
            const wrap = el('div');
            wrap.appendChild(box);
            const quick = arr(p.quick);
            if (quick.length) {
                const q = el('div', 'ui-quick');
                quick.forEach((v) => {
                    const b = el('button', '', String(v));
                    b.addEventListener('click', () => set(v));
                    q.appendChild(b);
                });
                wrap.appendChild(q);
            }
            return field(p, c, wrap);
        },
    });

    // day / month / year selects; value { day, month, year } (or 'YYYY-MM-DD')
    C('date', {
        render(p, c) {
            const parse = (v) => {
                if (v && typeof v === 'object') return { day: num(v.day, 1), month: num(v.month, 1), year: num(v.year, 1880) };
                const m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(txt(v));
                return m ? { year: +m[1], month: +m[2], day: +m[3] } : { day: 1, month: 1, year: num(p.maxYear, 1880) };
            };
            const d = parse(p.name ? c.value(p.name, parse(p.value)) : p.value);
            if (p.name) c.setValue(p.name, d);
            const daysIn = (m, y) => new Date(y, m, 0).getDate();
            const labels = p.labels || {};
            const grid = el('div', 'ui-date');

            const mk = (key, from, to, desc) => {
                const s = el('select');
                for (let v = from; desc ? v >= to : v <= to; v += desc ? -1 : 1) {
                    const o = el('option', '', String(v).padStart(key === 'year' ? 4 : 2, '0'));
                    o.value = v;
                    s.appendChild(o);
                }
                s.value = d[key];
                s.disabled = !!p.disabled;
                s.addEventListener('change', () => {
                    d[key] = num(s.value);
                    const max = daysIn(d.month, d.year);
                    if (d.day > max) d.day = max;
                    if (p.name) c.setValue(p.name, { ...d });
                    draw();
                    changed(p, c, { ...d }, false);
                });
                const w = el('div');
                if (labels[key]) w.appendChild(el('span', 'lbl', labels[key]));
                w.appendChild(s);
                return w;
            };
            const draw = () => {
                grid.innerHTML = '';
                const minY = num(p.minYear, 1800), maxY = num(p.maxYear, 1900);
                grid.append(
                    mk('day', 1, daysIn(d.month, d.year)),
                    mk('month', 1, 12),
                    mk('year', Math.max(minY, maxY), Math.min(minY, maxY), true),
                );
            };
            draw();
            return field(p, c, grid);
        },
    });
    /* ================================================================== step 4: fks-stables pieces */

    /* ------------------------------------------------------------------ medals (round ink buttons) */
    const RING = '<svg class="ring" viewBox="0 0 64 64"><circle class="a" cx="32" cy="32" r="28"/><circle class="b" cx="32" cy="32" r="24.5"/></svg>';
    C('medals', {
        render(p, c) {
            const size = p.size || 'normal';
            const grid = el('div', `medals ${size}`);
            grid.style.gridTemplateColumns = `repeat(${num(p.cols, size === 'small' ? 4 : 2)}, minmax(0, 1fr))`;
            arr(p.items).forEach((it) => {
                const b = el('button', `med${it.warn ? ' warn' : ''}`);
                b.disabled = !!it.disabled;
                const disc = el('span', 'disc');
                disc.innerHTML = RING;
                if (it.img) {
                    const im = el('img', 'ico img');
                    im.src = it.img;
                    im.onerror = () => im.replaceWith(icon(it.icon || 'box'));
                    disc.appendChild(im);
                } else {
                    disc.appendChild(icon(it.icon || 'box'));
                }
                if (it.badge !== undefined && it.badge !== null) disc.appendChild(el('span', 'badge', txt(it.badge)));
                b.append(disc, el('span', 'lbl', it.label));
                if (it.sub) b.appendChild(el('span', 'sub', it.sub));
                b.addEventListener('click', () => c.fire({ ...it, action: it.action || p.action }, { id: p.id }, b));
                grid.appendChild(b);
            });
            return grid;
        },
    });

    /* ------------------------------------------------------------------ seals (wax price stamps) */
    const SEAL_PATH = (() => {
        const n = 26, pts = [];
        for (let i = 0; i < n * 2; i += 1) {
            const a = (i / (n * 2)) * Math.PI * 2, r = i % 2 ? 29.2 : 31.6;
            pts.push(`${(32 + Math.cos(a) * r).toFixed(2)},${(32 + Math.sin(a) * r).toFixed(2)}`);
        }
        return `M${pts.join('L')}Z`;
    })();
    C('seals', {
        render(p, c) {
            const box = el('div', 'seals');
            arr(p.items).forEach((it) => {
                const gold = it.cur === 'gold';
                const b = el('button', `seal ${gold ? 'gold' : 'cash'} stamp`);
                b.disabled = !!it.disabled;
                const wax = el('span', 'wax');
                wax.innerHTML = `<svg viewBox="0 0 64 64"><path class="edge" d="${SEAL_PATH}"/><circle class="inner" cx="32" cy="32" r="24"/></svg>`;
                const amount = el('b');
                const inner = el('span');
                if (!gold) inner.appendChild(el('small', '', '$'));
                inner.append(FKS.fmt(it.amount, gold ? 2 : 0));
                amount.appendChild(inner);
                wax.appendChild(amount);
                b.append(wax, el('span', 'cap', it.label || c.t(gold ? 'ui_gold' : 'ui_cash')));
                b.addEventListener('click', () => c.fire({ ...it, action: it.action || p.action }, { id: p.id, cur: it.cur }, b));
                box.appendChild(b);
            });
            return box;
        },
    });

    /* ------------------------------------------------------------------ carousel (‹ value ›) */
    // With `items` it browses locally and sends { index, value }; without, every arrow sends { dir }
    // and the script answers with the new page (the slide animation survives the re-render).
    const flips = {};
    C('carousel', {
        render(p, c) {
            const box = el('div', `car ${p.size || 'big'}`);
            const items = arr(p.items).map((o) => (typeof o === 'object' ? o : { label: String(o), value: o }));
            const local = items.length > 0;
            let index = Math.max(0, Math.min(num(p.index, 0), Math.max(items.length - 1, 0)));
            const prev = el('button', 'arr');
            prev.appendChild(icon('left', ''));
            const next = el('button', 'arr');
            next.appendChild(icon('right', ''));
            const val = el('div', 'car-val');
            const label = el('b');
            const count = el('small');
            val.append(label, count);
            box.append(prev, val, next);

            const draw = () => {
                label.textContent = local ? txt(items[index] && items[index].label) : txt(p.label);
                const cnt = p.count !== undefined ? txt(p.count) : (local ? `${index + 1} / ${items.length}` : '');
                count.textContent = cnt;
                count.classList.toggle('hidden', !cnt);
                const off = p.disabled || (local && items.length < 2);
                prev.disabled = !!off;
                next.disabled = !!off;
            };
            const flip = (dir) => {
                val.style.setProperty('--d', dir);
                val.classList.remove('flip');
                void val.offsetWidth;
                val.classList.add('flip');
            };
            const step = (dir) => {
                if (prev.disabled) return;
                if (local) {
                    const n = items.length;
                    index = p.wrap === false ? Math.max(0, Math.min(n - 1, index + dir)) : (index + dir + n) % n;
                    p.index = index;
                    draw();
                    flip(dir);
                    if (p.action) c.debounce(`car:${p.id}`, () => c.emit(p.action, { id: p.id, index, value: items[index].value, dir }), num(p.delay, 120));
                } else {
                    if (p.id !== undefined) flips[p.id] = dir;
                    if (p.action) c.emit(p.action, { id: p.id, dir });
                }
            };
            prev.addEventListener('click', () => step(-1));
            next.addEventListener('click', () => step(1));
            if (p.listAction || p.listPrompt) {
                label.classList.add('link');
                label.addEventListener('click', () => c.fire({ action: p.listAction, prompt: p.listPrompt, value: local ? (items[index] || {}).value : p.value }, { id: p.id }, box));
            }
            if (p.keys && c.key) {
                const [a, b] = p.keys === 'updown' ? ['ArrowUp', 'ArrowDown'] : ['ArrowLeft', 'ArrowRight'];
                c.key(a, () => step(-1));
                c.key(b, () => step(1));
            }
            draw();
            if (p.id !== undefined && flips[p.id]) {
                flip(flips[p.id]);
                delete flips[p.id];
            }
            return box;
        },
    });

    /* ------------------------------------------------------------------ ring (progress circle) */
    C('ring', {
        render(p) {
            const v = Math.max(0, Math.min(1, num(p.value)));
            const n = el('div', `lvl${p.text === undefined ? ' pct' : ''}`);
            const C2 = 2 * Math.PI * 26;
            n.innerHTML = `<svg viewBox="0 0 64 64"><circle class="bg" cx="32" cy="32" r="26"/><circle class="fg" cx="32" cy="32" r="26" stroke-dasharray="${C2}" stroke-dashoffset="${C2 * (1 - v)}"/></svg>`;
            const b = el('b');
            if (p.text === undefined) b.append(String(Math.floor(v * 100)), el('i', '', '%'));
            else b.textContent = txt(p.text);
            n.appendChild(b);
            if (p.label) n.appendChild(el('small', '', p.label));
            return n;
        },
    });

    /* ------------------------------------------------------------------ facts (icon + value in a row) */
    C('facts', {
        render(p) {
            const n = el('div', 'facts');
            arr(p.items).forEach((it) => {
                const s = el('span', it.badge ? `bdg ${it.tone || ''}` : '');
                if (it.icon) s.appendChild(icon(it.icon));
                s.append(txt(it.text));
                n.appendChild(s);
            });
            return n;
        },
    });

    /* ------------------------------------------------------------------ tier (rank in a diamond) */
    const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
    C('tier', {
        render(p) {
            const n = el('div', 'tier');
            if (p.label) n.append(txt(p.label));
            const d = el('i');
            d.appendChild(el('span', '', typeof p.value === 'number' && p.roman !== false ? (ROMAN[p.value] || String(p.value)) : txt(p.value)));
            n.appendChild(d);
            if (p.text) n.append(txt(p.text));
            return n;
        },
    });

    /* ------------------------------------------------------------------ chips (toggle several) */
    C('chips', {
        render(p, c) {
            const box = el('div', 'chips');
            const opts = arr(p.options).map((o) => (typeof o === 'object' ? o : { value: o, label: String(o) }));
            let cur = arr(p.name ? c.value(p.name, arr(p.value)) : p.value);
            opts.forEach((o) => {
                const b = el('button', `chip${cur.includes(o.value) ? ' on' : ''}`, o.label);
                b.disabled = !!(p.disabled || o.disabled);
                b.addEventListener('click', () => {
                    const on = !cur.includes(o.value);
                    cur = on ? [...cur, o.value] : cur.filter((x) => x !== o.value);
                    p.value = cur;
                    b.classList.toggle('on', on);
                    if (p.name) c.setValue(p.name, cur);
                    if (p.action) c.emit(p.action, { id: p.id, name: p.name, value: cur, option: o.value, on });
                });
                box.appendChild(b);
            });
            return field(p, c, box);
        },
    });

    /* ------------------------------------------------------------------ timers (countdowns) */
    const mmss = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
    setInterval(() => {
        document.querySelectorAll('.ui-timer b[data-end]').forEach((b) => {
            b.textContent = mmss(Math.max(0, (Number(b.dataset.end) - Date.now()) / 1000));
        });
    }, 1000);
    C('timers', {
        render(p) {
            const box = el('div', 'ui-timers');
            arr(p.items).forEach((it) => {
                const row = el('div', 'ui-timer');
                const b = el('b', '', mmss(Math.max(0, num(it.seconds))));
                b.dataset.end = Date.now() + num(it.seconds) * 1000;
                row.append(el('span', '', it.label), b);
                box.appendChild(row);
            });
            return box;
        },
    });
    /* ================================================================== conversations (fks-chat reports) */

    // time: unix seconds -> HH:MM on this PC; a string is shown as it is
    const hhmm = (v) => {
        if (typeof v === 'string') return v;
        const d = v ? new Date(Number(v) * 1000) : new Date();
        return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    };

    // messages: items = { { name, text, time?, right?, tone? } }; always scrolled to the newest
    C('thread', {
        render(p) {
            const box = el('div', 'ui-thread');
            if (p.height) box.style.maxHeight = `calc(${num(p.height)} * var(--u))`;
            const items = arr(p.items);
            if (!items.length && p.empty) box.appendChild(el('div', 'ui-thread-empty', p.empty));
            items.forEach((m) => {
                const d = el('div', `tm${m.right ? ' right' : ''}${m.tone ? ` ${m.tone}` : ''}`);
                const head = el('div', 'tm-head');
                head.appendChild(el('b', '', m.name));
                if (m.time !== undefined && m.time !== null) head.append(` · ${hhmm(m.time)}`);
                d.append(head, el('div', 'tm-body', m.text));
                box.appendChild(d);
            });
            requestAnimationFrame(() => { box.scrollTop = box.scrollHeight; });
            return box;
        },
    });

    // one-line reply box: Enter or the button sends { value = text } and clears it
    C('composer', {
        render(p, c) {
            const box = el('div', 'ui-composer');
            const input = el('input');
            input.type = 'text';
            input.spellcheck = false;
            if (p.max) input.maxLength = num(p.max);
            if (p.placeholder) input.placeholder = p.placeholder;
            input.value = txt(p.name ? c.value(p.name, '') : '');
            input.disabled = !!p.disabled;
            const btn = el('button', 'btn ico-btn');
            btn.appendChild(icon(p.icon || 'send'));
            if (p.label) btn.appendChild(el('span', '', p.label));
            btn.disabled = !!p.disabled;
            box.append(input, btn);
            const send = async () => {
                const text = input.value.trim();
                if (!text || box.classList.contains('busy')) return;
                input.value = '';
                if (p.name) c.setValue(p.name, '');
                await c.fire({ action: p.action }, { value: text, id: p.id }, box);
                input.focus();
            };
            input.addEventListener('input', () => { if (p.name) c.setValue(p.name, input.value); });
            input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); send(); } });
            btn.addEventListener('click', send);
            if (p.autofocus !== false && !p.disabled) setTimeout(() => input.focus(), 60);
            return box;
        },
    });
    /* ================================================================== color picker */
    const SWATCHES = ['#ffffff', '#e8dcc4', '#cfc2a6', '#a39a88', '#f2c14e', '#e2ae3c', '#e0874a', '#d9553f', '#e88aa8', '#c79ad6', '#8fb3c9', '#6fc2b0', '#9cc27a'];
    const hex = (v) => (/^#[0-9a-f]{6}$/i.test(String(v)) ? String(v).toLowerCase() : '#ffffff');

    // swatches + a custom colour; value '#rrggbb'
    C('color', {
        render(p, c) {
            const box = el('div', 'ui-color');
            let cur = hex(p.name ? c.value(p.name, p.value) : p.value);
            const list = (arr(p.swatches).length ? arr(p.swatches) : SWATCHES).map(hex);
            const buttons = [];
            const customWrap = el('label', 'sw custom');
            const custom = el('input');
            custom.type = 'color';
            customWrap.appendChild(custom);
            const paint = () => {
                buttons.forEach(([b, v]) => b.classList.toggle('on', v === cur));
                custom.value = cur;
                customWrap.style.setProperty('--s', cur);
                customWrap.classList.toggle('on', !list.includes(cur));
            };
            const set = (v) => {
                cur = hex(v);
                p.value = cur;
                if (p.name) c.setValue(p.name, cur);
                paint();
                if (p.action) c.emit(p.action, { id: p.id, name: p.name, value: cur });
            };
            list.forEach((v) => {
                const b = el('button', 'sw');
                b.style.setProperty('--s', v);
                b.disabled = !!p.disabled;
                b.addEventListener('click', () => set(v));
                buttons.push([b, v]);
                box.appendChild(b);
            });
            custom.disabled = !!p.disabled;
            custom.addEventListener('input', () => set(custom.value));
            box.appendChild(customWrap);
            paint();
            return field(p, c, box);
        },
    });
})();
