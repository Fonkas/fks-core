'use strict';

/* =====================================================================
   Browser dev mode: open html/index.html outside the game to design screens without a server.
   Loaded only when the page is not running in game, and not listed in fxmanifest.lua (never shipped).
   The views below are shaped like the fks-character screens, so they double as API examples.
   ===================================================================== */
(() => {
    const send = (action, data) => window.postMessage({ action, data }, '*');
    const log = (...a) => console.log('%c[dev]', 'color:#f2c14e', ...a);

    /* ------------------------------------------------------------------ sample views */
    const character = (first, last, extra) => ({
        type: 'kv',
        items: [
            { label: 'Born', value: extra.born }, { label: 'Nationality', value: extra.nat },
            { label: 'Job', value: extra.job }, { label: 'Money', value: `$${extra.money}` },
            { label: 'Gold', value: extra.gold, tone: 'gold' },
        ],
    });
    const rowActions = (name) => [
        { label: 'Play', action: 'play' },
        {
            label: 'Rename', style: 'ghost', action: 'rename',
            prompt: { title: 'Rename', fields: [{ name: 'first', label: 'First name', value: name.split(' ')[0], required: true }, { name: 'last', label: 'Last name', value: name.split(' ')[1], required: true }] },
        },
        {
            label: 'Delete', style: 'ghost', action: 'delete',
            prompt: { title: 'Delete character', danger: true, ok: 'Delete', text: `This deletes **${name}** for good.`, note: 'Type the full name to confirm.', fields: [{ name: 'confirm', placeholder: name, match: name }] },
        },
    ];

    const selection = {
        eyebrow: 'FKS · Characters', title: 'Valentine', subtitle: 'Choose a character', count: '2 / 3',
        hints: [['ESC', 'Leave']],
        body: [{
            type: 'list', id: 'chars', action: 'preview',
            items: [
                { value: 'a', title: 'Arthur Morgan', tag: '#12', sub: '36 years · Male · Rancher', details: [character('Arthur', 'Morgan', { born: '03/02/1863', nat: 'American', job: 'Rancher', money: '1,240', gold: '3.50' })], actions: rowActions('Arthur Morgan') },
                { value: 'b', title: 'Sadie Adler', flag: '✝', tag: '#31', sub: '29 years · Female · Bounty hunter', details: [character('Sadie', 'Adler', { born: '11/07/1870', nat: 'American', job: 'Bounty hunter', money: '310', gold: '0.80' })], actions: rowActions('Sadie Adler') },
                { variant: 'empty', title: 'Create character', sub: 'Empty slot', action: 'create' },
                {
                    variant: 'locked', title: 'Extra slot', sub: 'Unlock with a purchase', action: 'tebex',
                    prompt: { title: 'Unlock a slot', text: 'Buy the slot in the store and paste the code here.', copy: 'https://fks.tebex.io', fields: [{ name: 'code', placeholder: 'tbx-...', pattern: 'tbx-[\\w-]+' }], ok: 'Redeem' },
                },
            ],
        }],
    };

    const creator = {
        eyebrow: 'Character creator', title: 'New character', page: 'identity',
        tabs: [{ page: 'identity', label: 'Identity' }, { page: 'face', label: 'Face' }, { page: 'finish', label: 'Finish' }],
        camera: {
            drag: true, wheel: true, keys: true,
            rail: {
                presets: [{ id: 'general', label: 'General' }, { id: 'face', label: 'Face' }, { id: 'upper', label: 'Torso' }, { id: 'body', label: 'Body' }],
                preset: 'general',
                hints: [['A / D', 'Rotate'], ['W / S', 'Zoom'], ['Q / E', 'Height'], ['Z / C', 'Side']],
            },
        },
        footer: {
            buttons: [
                { type: 'button', label: 'Random', icon: 'dice', style: 'ghost', small: true, action: 'random' },
                { type: 'button', label: 'Reset', icon: 'undo', style: 'ghost', small: true, action: 'reset', confirm: { title: 'Reset?', text: 'Undo every change on this tab?' } },
            ],
            main: { label: 'Finish', go: 'finish' },
        },
        pages: {
            identity: {
                title: 'Identity', count: '1 / 3', desc: 'Who is this person? Name, age and where they come from.',
                nav: { prev: { action: 'cancel', confirm: { title: 'Leave?', text: 'Go back to the character list?' } }, next: 'face' },
                body: [
                    {
                        type: 'grid', cols: 2, children: [
                            { type: 'input', name: 'firstname', label: 'First name', max: 20, live: true, action: 'name' },
                            { type: 'input', name: 'lastname', label: 'Last name', max: 20, live: true, action: 'name' },
                        ],
                    },
                    { type: 'segmented', name: 'model', label: 'Gender', value: 'mp_male', action: 'model', options: [{ value: 'mp_male', label: 'Male', icon: 'male' }, { value: 'mp_female', label: 'Female', icon: 'female' }] },
                    { type: 'date', id: 'birth', name: 'birth', label: 'Birth date', value: { day: 1, month: 1, year: 1875 }, minYear: 1820, maxYear: 1882, labels: { day: 'Day', month: 'Month', year: 'Year' }, note: 'Age: 24 years', action: 'birth' },
                    { type: 'slider', style: 'field', name: 'height', label: 'Height', min: 150, max: 200, step: 1, value: 178, format: 'int', suffix: ' cm', action: 'height', throttle: 120 },
                    {
                        type: 'grid', cols: 2, children: [
                            { type: 'input', name: 'nationality', label: 'Nationality', optional: true, max: 30 },
                            { type: 'input', name: 'birthplace', label: 'Birthplace', optional: true, max: 30 },
                        ],
                    },
                    { type: 'textarea', name: 'bio', label: 'Biography', optional: true, max: 500 },
                ],
            },
            face: {
                title: 'Face', count: '2 / 3', desc: 'Shape the face. Drag the dials or use the arrows.',
                nav: { prev: 'identity', next: 'finish' },
                body: [
                    { type: 'section', label: 'Head' },
                    {
                        type: 'dials', action: 'set', items: [
                            { id: 'head', label: 'Head', value: 3, count: 20 },
                            { id: 'eyes', label: 'Eyes', value: 1, count: 12 },
                            { id: 'beard', label: 'Beard', value: 0, count: 30, none: true, noneLabel: 'None' },
                            { id: 'teeth', label: 'Teeth', value: 2, count: 7 },
                            { id: 'scar', label: 'Scars', value: 0, count: 16, none: true, noneLabel: 'None' },
                            { id: 'hair', label: 'Hair', value: 5, count: 40 },
                        ],
                    },
                    { type: 'section', label: 'Shape' },
                    {
                        type: 'stats', action: 'set', rows: [
                            { kind: 'slider', id: 'nose_w', label: 'Nose width', min: -1, max: 1, step: 0.01, value: 0, format: 'signed' },
                            { kind: 'slider', id: 'jaw', label: 'Jaw', min: -1, max: 1, step: 0.01, value: 0.3, format: 'signed' },
                            { kind: 'slider', id: 'paint', label: 'Face paint', min: 0, max: 1, step: 0.01, value: 0.5, format: 'percent' },
                        ],
                    },
                ],
            },
            finish: {
                title: 'Finish', count: '3 / 3', nav: { prev: 'face' },
                footer: { main: { label: 'Create character', action: 'finish', pulse: true } },
                body: [
                    { type: 'text', text: 'Check the details. You can change your looks later at a barber or a tailor.' },
                    { type: 'kv', id: 'summary', items: [{ label: 'Name', value: '—' }, { label: 'Born', value: '01/01/1875' }, { label: 'Height', value: '178 cm' }, { label: 'Gender', value: 'Male' }] },
                    { type: 'section', label: 'Where do you arrive?' },
                    { type: 'segmented', style: 'list', name: 'spawn', value: 1, options: [{ value: 1, label: 'Valentine' }, { value: 2, label: 'Saint Denis' }, { value: 3, label: 'Blackwater' }, { value: 4, label: 'Strawberry' }] },
                ],
            },
            kits: {
                layout: 'center', eyebrow: 'Last step', heading: 'Choose your starter kit', desc: 'Every kit gives you something to start your life in the West.', back: false, camera: false,
                body: [{
                    type: 'cards', name: 'kit', submit: { action: 'kit' }, items: [
                        { value: 'hunter', title: 'Hunter', text: 'Live off the land.', lines: [{ amount: 1, label: 'Varmint rifle' }, { amount: 50, label: 'Ammo' }, { amount: 2, label: 'Bait' }] },
                        { value: 'farmer', title: 'Farmer', text: 'Seeds and a strong back.', lines: [{ amount: 10, label: 'Wheat seeds' }, { amount: 1, label: 'Hoe' }, { amount: 5, label: 'Bread' }] },
                        { value: 'outlaw', title: 'Outlaw', text: 'Nobody asks questions.', lines: [{ amount: 1, label: 'Revolver' }, { amount: 24, label: 'Ammo' }, { amount: 1, label: 'Bandana' }] },
                    ],
                }],
                footer: {
                    main: false,
                    buttons: [
                        { type: 'button', label: 'Back', style: 'ghost', go: 'finish' },
                        { type: 'button', label: 'Start', style: 'main', iconRight: 'fwd', requires: 'kit', action: 'kit' },
                    ],
                },
                hints: [],
            },
        },
    };

    /* ------------------------------------------------------------------ stable (shaped like fks-stables) */
    const horseStats = (s) => ({
        type: 'stats', rows: [
            { label: 'Speed', value: s[0] }, { label: 'Acceleration', value: s[1] },
            { label: 'Health', value: s[2] }, { label: 'Stamina', value: s[3] },
            { label: 'Handling', value: s[4] * 2.5, tone: 'gold', text: ['', 'Heavy', 'Standard', 'Elite', 'Race'][s[4]] },
        ],
    });
    const stable = {
        eyebrow: 'Stable', title: 'Valentine Stables', page: 'home',
        camera: { drag: true, wheel: true },
        footer: { money: { cash: 1240, gold: 3.5 } },
        hints: [['ESC', 'Back']],
        pages: {
            home: {
                hints: [['ESC', 'Close']],
                body: [{
                    type: 'medals', size: 'big', items: [
                        { label: 'Buy a horse', icon: 'horse', go: 'shop' },
                        { label: 'My horses', icon: 'shoe', sub: '2 / 5', go: 'mine' },
                        { label: 'Buy a wagon', icon: 'wagon', action: 'soon' },
                        { label: 'My wagons', icon: 'wheel', sub: '0 / 2', action: 'soon' },
                        { label: 'Breeding', icon: 'heart', sub: '1 in progress', go: 'breed', badge: 1 },
                    ],
                }],
            },
            shop: {
                title: 'Buy a horse',
                hints: [['← →', 'Coat'], ['↑ ↓', 'Breed'], ['⟲', 'Rotate']],
                body: [
                    { type: 'carousel', id: 'breed', size: 'big', keys: 'updown', action: 'preview', listAction: 'breedList', items: [{ label: 'American Paint', value: 1 }, { label: 'Arabian', value: 2 }, { label: 'Turkoman', value: 3 }] },
                    { type: 'carousel', id: 'coat', size: 'small', keys: 'leftright', action: 'preview', items: [{ label: 'Splashed Bay', value: 11 }, { label: 'Overo Chestnut', value: 12 }] },
                    {
                        type: 'row', align: 'center', children: [
                            { type: 'tier', label: 'TIER', value: 2 },
                            { type: 'segmented', style: 'round', name: 'gender', value: 'male', action: 'preview', options: [{ value: 'male', icon: 'male' }, { value: 'female', icon: 'female' }] },
                        ],
                    },
                    { type: 'facts', items: [{ icon: 'bag', text: '450' }, { icon: 'pelt', text: '2' }, { text: 'Breeding: Yes' }] },
                    horseStats([6, 5, 7, 6, 2]),
                    { type: 'text', text: 'A calm, steady horse. Popular with ranchers across New Hanover.' },
                    { type: 'seals', action: 'buy', items: [{ cur: 'cash', amount: 425, value: 11 }, { cur: 'gold', amount: 12, value: 11 }] },
                ],
            },
            mine: {
                title: 'My horses', count: '1 / 2',
                hints: [['← →', 'Browse'], ['⟲', 'Rotate']],
                body: [
                    { type: 'carousel', id: 'mine', size: 'big', keys: 'leftright', action: 'mine', items: [{ label: 'Buttercup', value: 7 }, { label: 'Boadicea', value: 8 }] },
                    { type: 'text', style: 'sub', text: 'Arabian · Rose Grey Bay' },
                    { type: 'badges', items: [{ text: 'Active', tone: 'gold' }, { text: 'Special', tone: 'gold' }] },
                    {
                        type: 'grid', template: 'auto 1fr', children: [
                            { type: 'ring', value: 0.62, label: 'TRAINING' },
                            { type: 'kv', items: [
                                { label: 'XP', value: '620 / 1000' }, { label: 'Gender', value: 'Female' },
                                { label: 'Age', value: '6 years' }, { label: 'At stable', value: 'Valentine' },
                                { label: 'Bond', rating: 3, max: 4, icon: 'shoe' },
                            ] },
                        ],
                    },
                    {
                        type: 'stats', rows: [
                            { label: 'Health', kind: 'bar', value: 88, tone: 'red', text: 88 },
                            { label: 'Stamina', kind: 'bar', value: 64, tone: 'amber', text: 64 },
                            { label: 'Hunger', kind: 'bar', value: 15, text: 15 },
                            { label: 'Thirst', kind: 'bar', value: 72, tone: 'blue', text: 72 },
                            { label: 'Courage', value: 6, text: 6 },
                        ],
                    },
                    {
                        type: 'medals', size: 'small', items: [
                            { label: 'Take out', icon: 'take', action: 'take', value: 7 },
                            { label: 'Equip', icon: 'saddle', go: 'custom' },
                            { label: 'Coat', icon: 'palette', action: 'soon' },
                            { label: 'Heal', icon: 'heal', disabled: true },
                            { label: 'Transfer', icon: 'transfer', action: 'transfer', value: 7, prompt: { title: 'Transfer to', fields: [{ type: 'segmented', style: 'list', cols: 1, name: 'to', required: true, options: [{ value: 'rhodes', label: 'Rhodes' }, { value: 'sd', label: 'Saint Denis' }] }] } },
                            { label: 'Rename', icon: 'quill', action: 'rename', value: 7, prompt: { title: 'New name', fields: [{ name: 'name', value: 'Buttercup', max: 24, required: true }] } },
                            { label: 'Sell', icon: 'coin', warn: true, action: 'sell', value: 7, confirm: { title: 'Sell', text: 'Sell **Buttercup** for **$212**?', danger: true } },
                        ],
                    },
                ],
            },
            custom: {
                title: 'Equipment', count: 'Buttercup',
                body: [
                    {
                        type: 'dials', action: 'part', items: [
                            { id: 'saddle', label: 'Saddle', value: 3, count: 24, none: true, noneLabel: 'Off' },
                            { id: 'blanket', label: 'Blanket', value: 0, count: 40, none: true, noneLabel: 'Off' },
                            { id: 'horn', label: 'Horn', value: 1, count: 8, none: true, noneLabel: 'Off' },
                        ],
                    },
                    { type: 'section', label: 'Extras' },
                    { type: 'chips', name: 'extras', value: [1], action: 'extras', options: [{ value: 1, label: 'Extra 1' }, { value: 2, label: 'Extra 2' }, { value: 3, label: 'Extra 3' }] },
                    { type: 'kv', id: 'total', cols: 1, items: [{ label: 'Total', value: '$35' }] },
                ],
                footer: { buttons: [{ type: 'button', label: 'Cancel', style: 'ghost', small: true, go: 'mine' }, { type: 'button', label: 'Confirm', small: true, action: 'save' }] },
            },
            breed: {
                title: 'Breeding',
                body: [
                    { type: 'carousel', size: 'small', items: [{ label: 'Boadicea', value: 8 }], count: '1 / 1' },
                    { type: 'text', style: 'sub', text: 'Arabian · 6 years · 620 / 1000 XP' },
                    { type: 'badges', items: [{ text: 'Ready to breed', tone: 'gold' }] },
                    { type: 'section', label: 'In progress' },
                    { type: 'timers', items: [{ label: 'Boadicea × Thunder', seconds: 754 }] },
                ],
            },
        },
    };

    const sheet = {
        eyebrow: 'HORSE SHEET', title: 'Buttercup', subtitle: 'Arabian · Rose Grey Bay',
        hints: [['Q', 'Close']],
        body: [
            { type: 'row', align: 'center', children: [{ type: 'tier', label: 'TIER', value: 3, text: '6 years' }] },
            { type: 'grid', template: 'auto 1fr', children: [{ type: 'ring', value: 0.62, label: 'TRAINING' }, { type: 'kv', items: [{ label: 'Bond', rating: 3, max: 4 }, { label: 'XP', value: '620 / 1000' }, { label: 'Bags', value: 450 }, { label: 'Pelts', value: 2 }] }] },
            { type: 'section', label: 'BREED STATS' },
            horseStats([6, 7, 5, 6, 3]),
            { type: 'section', label: 'CONDITION' },
            { type: 'stats', rows: [{ label: 'Health', kind: 'bar', value: 88, tone: 'red', text: 88 }, { label: 'Hunger', kind: 'bar', value: 15, text: 15 }] },
        ],
    };

    /* ------------------------------------------------------------------ fake handlers (what a script would answer) */
    FKS.dev = async (name, d) => {
        log(name, JSON.parse(JSON.stringify(d)));
        await new Promise((r) => setTimeout(r, 120));
        if (name === 'ui:close') return { closed: true };
        if (name === 'ui:choose' && d.done) { send('ui:choose', { on: false }); return {}; }
        if (name === 'ui:block') {
            if (d.kind === 'pick') send('ui:pick', { on: false });
            FKS.toast(`${d.kind}: ${JSON.stringify(d.value)}`);
            return {};
        }
        if (name !== 'ui:action') return {};
        const v = d.data || {};
        switch (d.action) {
            case 'name': {
                const f = FKS.S.values;
                const full = `${f.firstname || ''} ${f.lastname || ''}`.trim();
                return { patch: { title: { text: full || 'New character' } } };
            }
            case 'birth': return { patch: { birth: { note: `Age: ${1899 - v.value.year} years` } } };
            case 'model': return { toast: { text: v.value === 'mp_female' ? 'Female model loaded' : 'Male model loaded' }, patch: { beard: { count: v.value === 'mp_female' ? 0 : 30, value: 0 } } };
            case 'random': return { patch: { head: { value: 1 + Math.floor(Math.random() * 20) }, eyes: { value: 1 + Math.floor(Math.random() * 12) }, jaw: { value: Math.round((Math.random() * 2 - 1) * 100) / 100 } } };
            case 'finish': {
                const f = v.values || {};
                if (!f.firstname || f.firstname.length < 2) return { errors: { firstname: 'The first name needs at least 2 letters.' } };
                return { go: 'kits' };
            }
            case 'kit': return { close: true, toast: { text: `Welcome! Kit: ${v.values.kit}`, type: 'success' } };
            case 'delete': return { toast: { text: 'Character deleted', type: 'success' } };
            case 'rename': return { toast: { text: `Renamed to ${v.values.first} ${v.values.last}` } };
            case 'tebex': return { ok: false, error: 'That code was already used.' };
            case 'play': return { close: true };
            case 'cancel': return { view: selection };
            case 'part': return { patch: { total: { items: [{ label: 'Total', value: `$${20 + v.value * 5}` }] } } };
            case 'sell': return { toast: { text: 'Buttercup sold for $212', type: 'success' } };
            case 'transfer': return { toast: { text: `Sent to ${v.values.to}` } };
            case 'buy': return { toast: { text: `Bought with ${v.cur}`, type: 'success' } };
            case 'breedList': return { toast: { text: 'A script would open a prompt with every breed here' } };
            case 'soon': return { ok: false, error: 'Not in this sample' };
            default: return {};
        }
    };

    /* ------------------------------------------------------------------ toolbar */
    const bar = document.createElement('div');
    bar.style.cssText = 'position:fixed;top:8px;left:50%;transform:translateX(-50%);z-index:999;display:flex;gap:6px;font:12px sans-serif';
    const btn = (label, fn) => {
        const b = document.createElement('button');
        b.textContent = label;
        b.style.cssText = 'padding:4px 8px;background:#222;color:#eee;border:1px solid #555;border-radius:3px;cursor:pointer';
        b.onclick = fn;
        bar.appendChild(b);
    };
    btn('Selection', () => send('ui:open', { owner: 'fks-character', view: JSON.parse(JSON.stringify(selection)), fresh: true, opts: {} }));
    btn('Creator', () => send('ui:open', { owner: 'fks-character', view: JSON.parse(JSON.stringify(creator)), fresh: true, opts: { closable: false } }));
    btn('Right side', () => send('ui:open', { owner: 'fks-character', view: JSON.parse(JSON.stringify(selection)), fresh: true, opts: { position: 'right' } }));
    btn('Confirm (Lua)', () => send('ui:modal', { id: 1, kind: 'confirm', title: 'Sell horse?', text: 'You get **$40** for Buttercup.', danger: true, ok: 'Sell' }));
    btn('Choose', () => send('ui:choose', { on: true, selected: 'mp_male', options: [{ value: 'mp_male', label: 'Male', icon: 'male' }, { value: 'mp_female', label: 'Female', icon: 'female' }], hints: [['TAB', 'Switch'], ['ENTER', 'Confirm']] }));
    btn('Cinematic', () => {
        send('ui:cinematic', { on: true, skip: 'Skip' });
        setTimeout(() => send('ui:cinematic', { on: true, title: 'Valentine', sub: 'NEW HANOVER' }), 900);
        setTimeout(() => send('ui:subtitle', { text: '"Welcome to Valentine, stranger."', ms: 3000 }), 1500);
        setTimeout(() => send('ui:cinematic', { on: false }), 6000);
    });
    btn('Caption', () => send('ui:caption', { on: true, text: 'Smile for the photo', hints: [['ENTER', 'Continue']], seconds: 5 }));
    btn('Stable', () => send('ui:open', { owner: 'fks-stables', view: JSON.parse(JSON.stringify(stable)), fresh: true, opts: {} }));
    btn('Sheet', () => send('ui:sheet', { on: true, owner: 'fks-stables', id: 'horse', view: sheet }));
    btn('Pick', () => send('ui:pick', { on: true, hint: 'Click the horse to revive · right click to cancel', dots: [{ id: 101, x: 0.35, y: 0.55, label: 'Buttercup' }, { id: 102, x: 0.62, y: 0.6, label: 'Thunder' }] }));
    btn('Minigame', () => send('ui:minigame', { on: true, kind: 'keys', duration: 12000, fallTime: 3200, spawnEvery: 900, spawnEveryEnd: 450, letters: 'ASDQWE' }));
    btn('Loading', () => { send('ui:loading', { on: true, text: 'Saving character' }); setTimeout(() => send('ui:loading', { on: false }), 1500); });
    btn('Close all', () => { send('ui:close', {}); send('ui:choose', { on: false }); send('ui:caption', { on: false }); send('ui:cinematic', { on: false }); send('ui:sheet', { on: false }); send('ui:pick', { on: false }); send('ui:minigame', { on: false }); });
    document.body.appendChild(bar);
    document.body.style.background = 'linear-gradient(135deg,#4a5a46,#2c2a24 60%,#6b5a3e)';
    send('init', { locale: { ui_confirm: 'Confirm', cancel: 'Cancel', ui_optional: 'optional', ui_loading: 'Loading...', ui_cash: 'Cash', ui_gold: 'Gold' }, theme: {}, notify: {}, progress: {} });
    log('dev mode: use the buttons at the top');
})();
