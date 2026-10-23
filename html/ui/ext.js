'use strict';

/* =====================================================================
   Extensions: a script's own JS / CSS loaded into this NUI (UIExtend), for screens that are not
   menus (the fks-chat message feed). Still one frame on the server.

   In the script's JS:
       FKS.extension(document.currentScript.dataset.owner, {
           mount(api) { ... },                 // api.root, api.call(name, data), api.focus(on), api.el, api.icon
           messages: { 'chat:open'(data) { ... } },   // UIExtSend(action, data) from its Lua
           unmount() { ... },
       });
   ===================================================================== */
(() => {
    const exts = {};      // owner -> { def, api }
    const pending = {};   // owner -> messages that arrived before its JS loaded

    function makeApi(owner) {
        const root = document.createElement('div');
        root.className = 'ext-root';
        root.dataset.owner = owner;
        document.body.appendChild(root);
        return {
            owner,
            root,
            el: FKS.el,
            icon: FKS.icon,
            call: (name, data = {}) => FKS.call('ui:ext', { owner, name, data }),
            focus: (on) => FKS.call('ui:extfocus', { owner, on: !!on }),
            // draws fks-core components (same look as the core screens) into `parent`; their actions go
            // to onAction(action, data) in the extension instead of Lua. `store` keeps the form values.
            render: (list, parent, onAction, store = {}) => {
                const c = {
                    ...ctx,
                    value: (name, fallback) => {
                        if (!name) return fallback;
                        if (!(name in store)) store[name] = fallback;
                        return store[name];
                    },
                    setValue: (name, v) => { if (name) store[name] = v; },
                    error: () => null,
                    register: () => {},
                    key: () => {},
                    emit: (action, data) => Promise.resolve(action ? onAction(action, data || {}) : null),
                    fire: async (p, extra = {}) => {
                        if (!p) return null;
                        if (p.confirm) {
                            FKS.modal.attach(FKS.isOpen());
                            if (!(await FKS.modal.confirm(typeof p.confirm === 'object' ? p.confirm : { text: p.confirm }))) return null;
                        }
                        if (!p.action) return null;
                        return onAction(p.action, { ...extra, value: extra.value !== undefined ? extra.value : p.value });
                    },
                };
                parent.innerHTML = '';
                FKS.renderList(list, parent, c);
                return parent;
            },
        };
    }

    FKS.extension = (owner, def) => {
        if (!owner || !def) return;
        if (exts[owner]) remove(owner);
        const api = makeApi(owner);
        exts[owner] = { def, api };
        try {
            if (def.mount) def.mount(api);
        } catch (e) {
            console.error(`[fks-core] extension ${owner} failed to mount`, e);
        }
        (pending[owner] || []).forEach((m) => deliver(owner, m.action, m.data));
        delete pending[owner];
    };

    function deliver(owner, action, data) {
        const x = exts[owner];
        const fn = x && x.def.messages && x.def.messages[action];
        if (!fn) return;
        try {
            fn(data, x.api);
        } catch (e) {
            console.error(`[fks-core] extension ${owner} message '${action}' failed`, e);
        }
    }

    function remove(owner) {
        const x = exts[owner];
        if (!x) return;
        try { if (x.def.unmount) x.def.unmount(x.api); } catch (e) { console.error(e); }
        x.api.root.remove();
        document.querySelectorAll(`[data-ext="${CSS.escape(owner)}"]`).forEach((n) => n.remove());
        delete exts[owner];
    }

    function load(d) {
        if (!d.owner || (!d.js && !d.jsText)) return;
        remove(d.owner);
        document.querySelectorAll(`[data-ext="${CSS.escape(d.owner)}"]`).forEach((n) => n.remove());
        // the text sent by Lua is injected directly; the URLs are only a fallback
        if (d.cssText) {
            const style = document.createElement('style');
            style.dataset.ext = d.owner;
            style.textContent = d.cssText;
            document.head.appendChild(style);
        } else if (d.css) {
            loadCss(d.owner, [d.css, d.cssAlt].filter(Boolean));
        }
        if (d.jsText) {
            const s = document.createElement('script');
            s.dataset.ext = d.owner;
            s.dataset.owner = d.owner;
            s.textContent = `${d.jsText}
//# sourceURL=ext-${d.owner}.js`;
            document.body.appendChild(s);
        } else {
            loadJs(d.owner, [d.js, d.jsAlt].filter(Boolean));
        }
    }

    // tries each url in turn (https://cfx-nui-<res>/... first, nui://<res>/... as a fallback)
    function loadJs(owner, urls) {
        const url = urls.shift();
        if (!url) return console.error(`[fks-core] could not load the extension script of ${owner}`);
        const s = document.createElement('script');
        s.src = url;
        s.dataset.ext = owner;
        s.dataset.owner = owner;
        s.onerror = () => { s.remove(); loadJs(owner, urls); };
        document.body.appendChild(s);
    }

    // a <link>; if the browser refuses it (wrong MIME type on some RedM builds), the text is fetched
    // and put in a <style> instead, so the extension never runs without its styles
    function loadCss(owner, urls) {
        const url = urls[0];
        if (!url) return;
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = url;
        link.dataset.ext = owner;
        link.onerror = async () => {
            link.remove();
            for (const u of urls) {
                try {
                    const r = await fetch(u);
                    if (!r.ok) continue;
                    const style = document.createElement('style');
                    style.dataset.ext = owner;
                    style.textContent = await r.text();
                    document.head.appendChild(style);
                    return;
                } catch (e) { /* next */ }
            }
            console.error(`[fks-core] could not load the extension styles of ${owner}: ${url}`);
        };
        document.head.appendChild(link);
    }

    Object.assign(handlers, {
        'ui:extend': load,
        'ui:ext': (d) => {
            if (exts[d.owner]) deliver(d.owner, d.action, d.data);
            else (pending[d.owner] = pending[d.owner] || []).push({ action: d.action, data: d.data });
        },
        'ui:ext:remove': (d) => { remove(d.owner); delete pending[d.owner]; },
    });
})();
