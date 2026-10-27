# fks-core UI — API design

> **Status:** steps 1–3 built and tested in game, steps 4–5 built (not yet tested in game), step 6 to do · **Target:** fks-core `2.1.0` (additive, nothing breaks)
> **Scope:** one shared NUI inside fks-core that every FKS script uses for its UI, plus the
> Lua API, components, events and focus rules that make it work.

---

## 1. Why

Today every FKS script with a UI ships its own `ui_page`. fks-character and fks-stables
both carry their own `html/` folder (~2.5k lines each), and most of it is the same thing:

| Duplicated today | fks-character | fks-stables | fks-core |
|---|---|---|---|
| Fonts (Rye, Alegreya ×3) | ✔ | ✔ (byte-identical) | ✔ |
| `panel.png` brush panel | ✔ | ✔ (identical) | own variant |
| CSS tokens (`--paper`, `--gold`, `--f-title`…) and blocks (`.head`, `.crumbs`, `.back`, `.btn`, `.stat`, `.dial`, modal) | ✔ | ✔ | partly |
| Dial, slider/stat row, modal, hints, camera "stage" (drag = rotate, wheel = zoom) | ✔ | ✔ | — |

Each `ui_page` is its own browser frame loaded on every client all the time. With N scripts
the client keeps N frames, N copies of the same fonts and images, and N different versions
of the same panel that slowly drift apart.

**After:** fks-core owns the **only** `ui_page`. Scripts keep their Lua logic, their own
locale strings and their own images, but they ship **no HTML, CSS or JS**. They describe a
screen in Lua and fks-core draws it.

**Goals**
1. One frame, one design system, one place to theme every FKS script.
2. fks-core stays the **only** dependency of an FKS script.
3. Developer friendly: plain exports and events, so third-party developers can also open
   FKS-style menus.
4. No regressions in look and feel: the fks-character and fks-stables screens can be rebuilt
   1:1 with the components below (see section 15).

**Non-goals**
- A general UI framework for any server. It is the FKS look, built for FKS scripts.
- Moving game logic (cameras, peds, server calls) into the core. The core draws and reports
  what the player clicked; the script decides what that means.

---

## 2. How it works

```
 fks-stables (client Lua)                     fks-core (client Lua)                fks-core NUI (one frame)
 ───────────────────────                      ─────────────────────                ────────────────────────
 UI.Open(view)  ─── exports['fks-core']:UIOpen ──►  focus manager ── SendNUIMessage ──►  renderer + components
                                                    (owner = fks-stables)
 UI.On('buy', fn) ◄── handler(action, data) ──────  routes to owner ◄── RegisterNUICallback('ui:action') ──  click
        │                                                                                    ▲
        └── returns { patch = … } / { go = … } / { toast = … } ─────────────────────────────┘
```

- **Owner**: the resource that called `UIOpen`. fks-core gets it from `GetInvokingResource()`,
  so actions can never reach another script.
- **Handler**: when a script opens a view it passes one dispatcher function (the helper in
  section 3 does this for you). fks-core calls it inside a thread, so the handler **can
  yield** (server callbacks, `Wait`), and whatever it returns goes back to the NUI.
- **State lives in the NUI while the menu is open** (slider positions, carousel index,
  current page). Lua sends a whole view once and then sends small **patches**, so dragging
  a slider never re-sends the screen.

---

## 3. Using it from a script

The client import loads a small wrapper that hides the raw exports. It is the same line
scripts already use:

```lua
-- fxmanifest.lua
shared_script '@fks-core/import.lua'   -- Bridge (server + client) and now UI (client)
fks_core_version '2.1.0'
```

```lua
-- client/stable.lua (simplified)
UI.On('buy', function(d)                       -- d.value = what the button carried
    local ok, err = Bridge.Callback('fks-stables:buyHorse', d.value)
    if not ok then return { ok = false, error = L(err) } end
    return { toast = { text = L('bought'), type = 'success' }, go = 'myHorses', data = MyHorsesPage() }
end)

UI.On('close', function(d) Stable.Close() end)  -- d.reason: esc | button | script | death | stop

UI.Open({
    eyebrow = L('title'), title = stable.label, page = 'home',
    camera  = { drag = true, wheel = true },           -- 'camera' action, see section 9
    footer  = { money = { cash = 120, gold = 3 } },
    pages   = {
        home = {
            body = {
                { type = 'button', label = L('home_buy_horse'), icon = 'horse', go = 'shopHorse' },
                { type = 'button', label = L('home_my_horses'), icon = 'shoe', go = 'myHorses' },
            },
            hints = { { 'ESC', L('close') } },
        },
        myHorses = MyHorsesPage(),
    },
})
```

The script never touches `SetNuiFocus`, `SendNUIMessage` or `RegisterNUICallback`.

**Try it without a server:** open `html/index.html` of fks-core in a browser. Dev mode
(`html/dev/dev.js`, never shipped) adds a toolbar with sample views shaped like the
fks-character screens (selection, creator, kits) and fake handlers that answer like a
script would. The sample views are also the best examples of the API.

---

## 4. Lua API

Every function is a client export of fks-core (`exports['fks-core']:UIOpen(...)`). The `UI`
table from `@fks-core/import.lua` (`bridge/ui.lua`) is a thin wrapper; both are supported.

### Menu (the main panel)

| `UI` helper | Export | Returns | What it does |
|---|---|---|---|
| `UI.Open(view, opts?)` | `UIOpen(view, opts, handler)` | `ok, err` | Opens the panel with focus. `err = 'busy'` when another resource holds the focus (section 8). Calling it again from the same script replaces the view. |
| `UI.Update(view)` | `UIUpdate(view)` | — | Replaces the whole view. Keeps the current page if it still exists, and keeps form values. |
| `UI.SetPage(id, page)` | `UISetPage(id, page)` | — | Adds or replaces one page (re-renders if it is the current one). |
| `UI.Patch(id, props)` / `UI.Patch({ [id] = props, … })` | `UIPatch(a, b)` | — | Changes props of components that have an `id`, without re-rendering the page. |
| `UI.Go(pageId)` | `UIGo(pageId)` | — | Navigates (pushes into the back history). |
| `UI.Close()` | `UIClose()` | — | Closes the panel. The script's `close` handler runs with `reason = 'script'`. Safe to call from inside that handler. |
| `UI.On(action, fn)` / `UI.Off(action)` | (handler) | — | Registers a handler: `fn(data) -> result?` (section 7). |
| `UI.IsOpen()` | `UIIsOpen()` | `bool, owner` | Whether any FKS panel is open, and which resource owns it. |

`opts`:

| Field | Default | |
|---|---|---|
| `closable` | `true` | `false` = ESC does nothing (character creation). |
| `position` | `Config.Theme.position` | `'left'` · `'right'`. |
| `keepInput` | `false` | The player can still move while the panel is open. Look and attack stay disabled. |
| `cursor` | `true` | `false` = keyboard-only focus. |
| `hideHud` | `false` | Hides the radar while open and shows it again on close. |
| `closeOnDeath` | `true` | On death the script gets `close` with `reason = 'death'` (it can refuse). |

### Dialogs (block until the player answers)

| Helper | Returns | |
|---|---|---|
| `UI.Confirm({ title, text, danger?, ok?, cancel? })` | `bool` | Shown inside the open panel, or centered on screen when no panel is open (then it takes the focus itself). `UI.Confirm('text')` also works. |
| `UI.Prompt({ title, text?, fields = {…}, ok? })` | `values` or `nil` | Fields are form components (section 6). `nil` when cancelled. |

Most confirms and prompts do not need Lua at all: any action can carry `confirm` or
`prompt` and the NUI asks first (section 7). Dialog texts accept `**bold**`; `copy` shows a
selectable box (a store link), `note` a small line under the text.

### Overlays (no focus)

| Helper | |
|---|---|
| `UI.Loading(text \| false)` | Full-screen spinner. |
| `UI.Toast(text, type?)` | Toast at the top of the screen (`inform`, `success`, `error`). For normal notifications keep using `Notify`. |
| `UI.Cinematic({ bars?, title?, sub?, skip?, skipKey? })` / `UI.Cinematic(false)` | Letterbox bars and a title card (fks-character train arrival). Calling it again without `title` fades the card out. `skip` is the text next to `skipKey` (default `ENTER`); the script handles the key. |
| `UI.Subtitle(text, ms?)` / `UI.Subtitle()` | Bottom subtitle line, optional auto-hide. |
| `UI.Tracker({ label, seconds?, bar = { value, label, tone } })` / `UI.Tracker(false)` | Small box at the top centre: a countdown (sending `seconds` again re-syncs it) and an optional 0-100% bar, `tone` = good / warn / bad (mission timer, detection). |
| `UI.Caption({ text, hints?, seconds? })` / `UI.Caption(false)` | Corner caption with key hints and an optional countdown (fks-character photo). |

### Side sheet (no focus)

| Helper | |
|---|---|
| `UI.Sheet(id, { eyebrow, title, subtitle, body = { components }, hints, position = 'right' })` | A read-only card on the side that does not take the focus (fks-stables horse card). Calling it again with the same `id` refreshes it in place (no animation). One sheet on screen at a time. |
| `UI.Sheet(id, false)` | Hides it. It also goes away when the owner stops. |

### Blocking pickers

They take the focus until answered. If the script owns the open panel, the panel hides
meanwhile and comes back after.

| Helper | Returns | |
|---|---|---|
| `UI.Choose({ options = { { value, label, icon? } }, selected?, hints?, cancel? }, onChange?)` | `value` (or `nil` if `cancel = true` and ESC) | Big options at the bottom (fks-character gender pick). TAB / arrows / A-D switch, ENTER / space / click confirm, hover selects. `onChange(value)` runs on every switch, for previews. `UI.Choose(false)` ends it from Lua (it returns `nil`). |
| `UI.Pick({ hint?, timeout?, refresh = 100, points? }, getPoints?)` | point `id` or `nil` | Clickable dots over world positions (fks-stables revive). `getPoints()` runs on every refresh and returns `{ { id, coords = vector3 \| entity = handle, label? } }`, so the list can change; return `nil` / `{}` to cancel. Off-screen points are hidden. Right click / ESC cancel; so do `timeout` (seconds), death and `UI.Pick(false)`. |
| `UI.Minigame('keys', { duration, fallTime, spawnEvery, spawnEveryEnd, letters })` | `true` (passed) / `false` | Letters fall from the top; press the key (or click) before they reach the bottom (fks-stables taming). Times in ms. `UI.Minigame(false)` stops it from Lua (it returns `false`), e.g. when the player falls off the horse. |

The existing `Notify` and `Progress` exports stay as they are and live in the same frame.

---

## 5. View format

```lua
view = {
    eyebrow = 'STABLE',          -- small caps line over the title
    title   = 'Valentine',       -- big title, shrinks to fit
    page    = 'home',            -- first page (Lua tables have no order, so always set it)
    pages   = { [id] = page },
    tabs    = { { page = 'identity', label = 'Identity' }, … },   -- chips that switch pages (no history)
    footer  = { … },             -- see below; a page's footer is merged over it
    hints   = { { 'ESC', 'Close' } },  -- default key hints (a page can override)
    camera  = { … },             -- section 9
    layout  = 'side',            -- 'side' (panel on the side) | 'center' (full-screen page) | 'wide' (big landscape panel, like /items)
}

-- one-page view: put the page fields at the top level instead of `pages`
view = { title = 'Characters', subtitle = 'Choose a character', count = '2 / 3', body = { … } }

page = {
    title   = 'My horses',       -- crumb title
    count   = '1 / 3',           -- right side of the crumb bar
    desc    = 'Short help line', -- line under the crumbs
    body    = { component, … },
    nav     = { prev = 'face', next = { action = 'cancel', confirm = { … } } },
                                 -- ‹ › buttons: a page id (switch, no history) or an action
    back    = false,             -- hide the history back button (it also hides when `nav` is set)
    hints   = { … },
    footer  = { … },
    tabs    = { … },             -- overrides view.tabs (center pages hide the view's tabs)
    layout  = 'center',          -- this page only (fks-character kits screen)
    heading = 'Choose your kit', -- big title for this page only
    eyebrow = 'Last step',
    camera  = false,             -- no camera on this page
}

footer = {
    buttons = { component, … },  -- small buttons on the left (Random / Reset)
    main    = { label = 'Continue', action = 'next', pulse = true } | false,  -- big gold button
    money   = { cash = 120, gold = 3 },
}
```

**Strings are always sent already translated** by the script (scripts keep their own
locales). The core only translates its own words (Confirm, Cancel, optional, Loading).

**Images** stay in the script and are referenced as `nui://<resource>/<path>`. Built-in
icons are referenced by name (`icon = 'horse'`, section 11).

**Lua tables:** empty tables arrive as `[]` and arrays with `nil` holes get compacted, so
never rely on positions in a list with holes.

---

## 6. Component catalog

Common props: `id` (needed for `Patch`), `hidden`, `class`. Interactive components take
`action` (sent to Lua) and/or `go` (local navigation, no Lua round trip). "Emits" is what
the handler receives (always plus `page`, section 7).

**Built (step 2):**

### Layout and text

| `type` | Props | Emits |
|---|---|---|
| `section` | `label` | — |
| `text` | `text` (`**bold**` allowed), `style = 'desc' \| 'muted' \| 'note' \| 'plain'` | — |
| `empty` | `text`, `button?` (button props) | — |
| `row` | `children`, `gap?`, `align?` | — |
| `grid` | `children`, `cols = 2`, `template?` (CSS grid template), `gap?` | — |
| `kv` | `items = { { label, value, tone = 'gold' \| 'bad' \| 'good' } }`, `cols = 2`. Empty values are skipped. An item with `rating = 3, max = 4, icon = 'shoe'` shows icons on / off (horse bond). | — |
| `badges` | `items = { { text, tone = 'gold' \| 'bad' } }` | — |

### Buttons and choices

| `type` | Props | Emits |
|---|---|---|
| `button` | `label`, `icon?`, `iconRight?`, `style = 'primary' \| 'ghost' \| 'danger' \| 'main'`, `small?`, `wide?`, `pulse?`, `disabled?`, `value?`, `confirm?`, `prompt?`, `requires = 'fieldName'` (disabled until that form value is set) | `{ value, values }` |
| `segmented` | `options = { { value, label?, icon? } }`, `value`, `name?`, `label?`, `style = 'pills' \| 'switch' \| 'list' \| 'round'` (round = icon-only circles), `cols` (list), `locked` (shows only the current one, disabled), `confirm?` | `{ value }`. If the handler answers `ok = false` the choice snaps back. |
| `medals` | `items = { { label, sub?, icon?, img?, badge?, warn?, disabled?, action?, go?, value?, confirm?, prompt? } }`, `size = 'big' \| 'normal' \| 'small'`, `cols` (2, or 4 when small), `action` (default for items) | `{ value }` |
| `seals` | `items = { { cur = 'cash' \| 'gold', amount, label?, value?, action?, confirm?, prompt?, disabled? } }`, `action` (default) | `{ value, cur }` |
| `chips` | `options`, `value` (list), `name?`, `action?` — toggles several (wagon extras) | `{ value = list, option, on }` |

### Selectors and values

| `type` | Props | Emits |
|---|---|---|
| `dials` | `items = { { id, label, value, count, none?, noneLabel?, min?, captions?, disabled? } }`, `cols = 3`, `noneLabel?`, `throttle = 90`. `min` overrides the lowest value (default 1, or 0 with `none`); `captions[n]` is the name shown for value `n` (wagon paints). | `{ id, value }`. Every item is patchable by its own `id` (`value`, `count`). |
| `slider` | `id`, `label`, `min`, `max`, `step`, `value`, `name?`, `style = 'stat' \| 'field'`, `format = 'signed' \| 'percent' \| 'int'`, `decimals?`, `suffix?`, `reset` (double-click value, default 0 when in range), `throttle = 60` | `{ id, name, value }` |
| `stats` | `rows = { { label, kind = 'ticks' \| 'bar' \| 'slider', value, max?, tone?, text? } }`, `action` (for slider rows) | slider rows emit like `slider` |
| `carousel` | `size = 'big' \| 'small'`, **local:** `items = { { label, value } }`, `index`, `wrap = true`; **from Lua:** `label`, `count`; `id` (keeps the slide animation across re-renders), `keys = 'leftright' \| 'updown'` (arrow keys), `listAction` / `listPrompt` (click on the name), `delay = 120` | local: `{ index, value, dir }` (debounced); from Lua: `{ dir }` and the handler returns the new page / patch |
| `ring` | `value` (0–1), `label`, `text?` (instead of the percentage) | — |
| `facts` | `items = { { icon?, text, badge?, tone? } }` | — |
| `tier` | `label`, `value` (numbers become I, II, III… unless `roman = false`), `text?` | — |
| `timers` | `items = { { label, seconds } }` — counts down on its own | — |

### Lists

| `type` | Props | Emits |
|---|---|---|
| `list` | `items = { { value, title, tag?, sub?, flag?, details = { components }, actions = { button props } } }`, `selected`, `name?`, `expand = 'selected' \| 'all' \| 'none'`. Special rows: `variant = 'empty' \| 'locked'` (with `icon`), or any row with its own `action` / `prompt` / `confirm` / `go` — those fire instead of selecting. | `{ value }` on select. Row buttons carry the row `value` unless they set one. |
| `cards` | `items = { { value, title, img?, text?, lines = { { img?, amount?, label } }, disabled? } }`, `selected`, `name?`, `cols?`, `submit` (action props fired on double-click) | `{ value }` on select |
| `thread` | `items = { { name, text, time?, right?, tone = 'gold' \| 'muted' } }`, `height = 40`, `empty?` — a conversation, always scrolled to the newest; `time` in unix seconds shows as HH:MM | — |
| `composer` | `name?` (keeps the draft across updates), `placeholder`, `max`, `action`, `icon = 'send'`, `label?` — one-line reply box, Enter or the button sends and clears | `{ value = text }` |
| `color` | `name?`, `label`, `value = '#rrggbb'`, `swatches?` (default palette), `action?` — swatches plus a custom colour | `{ value }` |

### Form fields (pages and `prompt` dialogs)

Every field with a `name` keeps its value in the view's **form values**: they survive tab
switches and `UI.Update`, and every button action sends them as `values`.

| `type` | Props | Emits (only with `action`) |
|---|---|---|
| `input` | `name`, `label`, `value`, `max?`, `placeholder?`, `optional?`, `live?` (send while typing, throttled), `throttle = 150` | `{ name, value }` |
| `textarea` | same as `input`; shows a counter when `max` is set | `{ name, value }` |
| `select` | `name`, `label`, `options` (values or `{ value, label }`), `value` | `{ name, value }` |
| `number` | `name`, `label`, `value`, `min`, `max`, `step`, `quick = { 1, 10, 100 }` | `{ name, value }` |
| `date` | `name`, `label`, `value = { day, month, year }` (or `'YYYY-MM-DD'`), `minYear`, `maxYear`, `labels = { day, month, year }`, `note` (patchable, e.g. the age) | `{ name, value }` |

Inside `prompt` fields also take `required`, `pattern` (regex) and `match` (the text the
player must type, ignoring case and extra spaces): the OK button stays disabled until all
of them pass.

Helper classes (`class = '...'`, any component): `box` (framed card; a `section` as its first child gets ornament
lines), `big` on `kv` (stat tiles with big numbers), `hero` on `ring` / `tier` (bigger), `fill` on a `grid` (its
children stretch to the same height in the wide layout).

`text` also takes `style = 'sub'` (centered small caps line under a title) and `row` takes
`align = 'center'`.

---

## 7. Actions and responses

Every interactive component can send an action. The handler gets the emit data plus `page`
(current page id) and `values` (the view's form values):

```lua
UI.On('sell', function(d)       -- d = { value = 12, page = 'myHorses', values = { … } }
    ...
    return result               -- optional
end)
```

`values` is the view's form values, or the prompt's values when the button had a `prompt`.

### Handled by the NUI before Lua sees the click

```lua
{ type = 'button', label = 'Sell', action = 'sell', value = horse.id,
  confirm = { title = 'Sell horse?', text = 'You get **$40**', danger = true } }

{ type = 'button', label = 'Rename', action = 'rename', value = horse.id,
  prompt = { title = 'New name', fields = { { name = 'name', value = horse.name, max = 24, required = true } } } }
-- handler gets d.values.name

{ type = 'button', label = 'Delete', action = 'delete', value = char.id,
  prompt = { title = 'Delete', danger = true, text = 'Type **John Marston** to confirm',
             fields = { { name = 'confirm', match = 'John Marston' } } } }
```

`go = 'pageId'` navigates without calling Lua. `go` + `action`: navigate first, then send.

### What a handler can return (all optional, can be combined)

| Field | Effect |
|---|---|
| `ok = false`, `error = 'text'` (or `message`) | Error toast. |
| `toast = { text, type }` | Toast. |
| `view = { … }` | Same as `UI.Update`. |
| `page = { … }` | Replaces the current page. |
| `go = 'id'`, `data = page?` | Navigates; with `data`, replaces that page first. |
| `back = true` | Goes back in the history first (runs before `view`, so a `view` without that page still lands right). |
| `patch = { [id] = props }` | Same as `UI.Patch`. |
| `errors = { fieldName = 'message' }` | Marks the fields red, goes to the page that has the first one and scrolls to it. The mark clears when the player edits the field. |
| `close = true` | Closes the panel (the `close` handler does not run again). |

While a button's handler runs it shows a busy state and ignores more clicks. If the handler
throws, the core prints `[fks-core] <owner>: UI action '<name>' failed` and the error shows
in the script's console.

### Built-in patch ids

`title`, `eyebrow`, `count`, `desc` take `{ text = … }`; `main` and `money` merge into the
footer; `camera` merges into the camera rail (e.g. `{ preset = 'face' }`).

### Reserved actions

| Action | When |
|---|---|
| `close` | ESC, `UI.Close()`, death, owner stopped, fks-core stopped. `d.reason` = `'esc' \| 'script' \| 'death' \| 'stop'`. Returning `false` keeps the panel open (not for `stop`). |
| `camera` | Stage input, section 9. |
| `page` | Every navigation: `{ from, to, back? }`. Use it for previews (fks-stables `doPreview`). |

> Actions are client-side input. Anything that costs money or changes data is still
> validated on the server, exactly like today.

---

## 8. Focus and layer management

fks-core is the **only** resource that calls `SetNuiFocus` for these screens
(`client/ui.lua`). That is what keeps two FKS scripts from fighting over the cursor.

| Layer | Focus | How many | Examples |
|---|---|---|---|
| `menu` | yes (cursor) | 1 | stable panel, character creator |
| `modal` | yes | 1, over its menu or alone | Confirm, Prompt |
| `blocking` | yes | 1 | `Choose`, `Pick`, `Minigame` |
| `sheet` | no | 1 | horse card |
| `overlay` | no | many | Notify, Progress, Toast, Loading, Cinematic, Subtitle, Caption |

### Rules

1. **One owner at a time.** `UIOpen`, `UIConfirm`, `UIPrompt` and `UIChoose` from a resource
   while another one owns the panel or a picker return `false, 'busy'` / `nil`. Nothing is
   queued. The same owner calling `UIOpen` again replaces its own view.
2. **A picker from the menu owner** (Choose while its panel is open) hides the panel, runs,
   then brings it back on the same page.
3. **ESC / Backspace:** close the modal → else go back in history (unless the page has
   `back = false` or `nav`) → else, if `closable`, send `close` (`reason = 'esc'`).
4. **Pause menu:** the panel hides and releases the focus while it is open.
   **Death:** the owner gets `close` with `reason = 'death'` (disable with `closeOnDeath`).
5. **Owner stops:** everything it owns closes at once and the focus is released. Its open
   dialogs return `false` / `nil`. No stuck cursor after a restart.
6. **fks-core stops:** the `UI` wrapper fires the script's `close` handler with
   `reason = 'stop'`, so the script resets its own state.

The admin item panel of fks-core still sets its own focus (it is core code); moving it onto
the shared UI is a later clean-up.

---

## 9. Camera stage

Both scripts have the same transparent "stage" behind the panel (drag = rotate, wheel =
zoom) and the character creator adds a rail of presets and tools. In the core it is
`view.camera` (or `page.camera`, `false` to turn it off on one page):

```lua
camera = {
    drag = true, wheel = true,     -- both default to true when `camera` is set
    keys = true,                   -- A/D rotate, W/S zoom, Q/E lift, Z/C pan, arrows
    rail = {
        presets = { { id = 'face', label = 'Face' }, { id = 'body', label = 'Body' } },
        preset  = 'face',          -- highlighted chip (patch 'camera' to change it)
        tools   = true,            -- rotate / zoom / lift / pan / reset buttons
        hints   = { { 'A / D', 'Rotate' } },
    },
}
```

The NUI only reports input through the `camera` action. The script still moves its own
camera:

| `d.kind` | Data |
|---|---|
| `drag` | `dx`, `dy` (pixels, batched once per frame) |
| `wheel` | `value` = `-1` (in) / `1` (out) |
| `rotate`, `zoom`, `lift`, `pan` | `value` = `-1` / `1`, `source = 'key' \| 'button'` |
| `reset` | `source = 'button'` |
| `preset` | `value` = preset id |

A shared Lua orbit-camera helper could come later; both scripts implement one today.

---

## 10. Events for other developers

| Event (client, local) | Args | Use |
|---|---|---|
| `fks-core:ui:opened` | `owner` | HUD scripts hide themselves |
| `fks-core:ui:closed` | `owner, reason` | HUD scripts come back |
| `fks-core:ui:focus` | `hasFocus` | other NUIs avoid opening on top |

Plus `LocalPlayer.state.fksUI = owner | nil` for scripts that prefer state bags.

---

## 11. Theming

One block in fks-core `config.lua` themes every FKS script at once:

```lua
Config.Theme = {
    scale    = 1.0,                 -- multiplies the base unit (--u)
    position = 'left',              -- default side of script panels: 'left' | 'right'
    colors   = {                    -- override any CSS token, nil = default
        paper = '#e8dcc4', gold = '#f2c14e', danger = '#d9553f', good = '#9cc27a',
    },                              -- paper2 / gold2 map to --paper-2 / --gold-2
}
-- later, if asked for: panel art swap, hover/click sounds
```

The tokens are the ones both scripts already share (`--paper`, `--paper-2`, `--muted`,
`--line`, `--gold`, `--gold-2`, `--danger`, `--good`, `--ink`, `--f-title`, `--f-label`,
`--f-body`, `--f-btn`). The logo already used by Notify (`html/logo.*`) is available to every
panel too.

**Icons:** one sprite in `html/index.html` of the core with every `<symbol>` the core and
both scripts use today, referenced by name without the `i-` prefix (`icon = 'horse'`):
`back fwd left right up down x plus minus plus-c search grid lock undo dice` ·
`panl panr rotl rotr reset` · `male female cross heart` ·
`horse shoe wagon wheel saddle palette pelt` ·
`heal transfer take quill hammer coin gold bag box` · `spur` (progress bar).
The ink filters (`#ink`, `#ink-soft`) and gradients (`#g-brass`, `#g-gold`, `#g-wax`) live
in the same sprite.

**Files (step 1, done):** `html/theme.css` holds the fonts, tokens, reset and the shared
pieces (`.eyebrow`, `.rule`, `.section-label`, `.desc`, `.btn` + `ghost`/`danger`/`small`/
`main`/`wide`, `.back`, `.arr`, `.chip(s)`, `.hints`/`kbd`, `.ico`, `.spin`).
`html/style.css` only keeps Notify, Progress and the admin item panel.
`html/img/panel.png` is the tall brush panel both scripts use.

---

## 12. Extensions (screens that are not menus)

Some screens are not menus at all: the fks-chat message feed is always on screen, has its own
input and its own focus. When a script needs something like that, there are two options, in
this order:

1. **Add it to the core** if another script could ever use it. This is the default.
2. **Extension (built, used by fks-chat):** the script keeps its own JS / CSS and fks-core
   loads them **into its frame**, so there is still only one NUI.

```lua
-- client (the script)
UI.Extend({ js = 'ui/chat.js', css = 'ui/chat.css' })   -- paths inside the script; list them in its `files`
UI.ExtSend('chat:message', { text = 'hi' })              -- Lua -> its JS
UI.OnExt('submit', function(data) ... end)               -- its JS -> Lua (api.call), may return a table
UI.ExtFocus(true)                                        -- take / give back mouse + keyboard
UI.HasFocus()                                            -- any FKS screen holding the focus? (don't open on top)
```

```js
// ui/chat.js (runs inside the fks-core page)
FKS.extension(document.currentScript.dataset.owner, {
    mount(api) { /* api.root (its own layer), api.call(name, data), api.focus(on), api.el, api.icon, api.render */ },
    messages: { 'chat:message'(data) { ... } },          // UI.ExtSend
    unmount() { ... },
});
```

- Messages sent before the JS loaded are kept and delivered once it registers.
- The extension's DOM lives in its own `.ext-root[data-owner="..."]` layer; prefix its classes
  (fks-chat uses `fc-`) so it never touches the core screens. Core tokens, fonts and the icon
  sprite are available.
- When the owner stops, its layer, script and styles are removed and its focus released.
  When fks-core restarts, the `UI` wrapper loads the extension again and calls `UI.OnExt('restart')`.
- An extension holding the focus counts for `UI.HasFocus()`; menus still have priority.
- `api.render(components, parent, onAction, store?)` draws core components inside the extension
  with the same look as the core screens; their actions go to `onAction(action, data)` in the
  extension instead of Lua (fks-hud builds its `/hudsettings` panel this way).
- Scripts with their own `Bridge` (fks-hud) can skip `@fks-core/import.lua` and call the exports
  directly: `UIExtend(files, handler)`, `UIExtSend`, `UIExtFocus`, `UIHasFocus`.

---

## 13. JS runtime inside fks-core

- Vanilla JS, no framework or build step, same as today.
- Files: `html/theme.css` (design system), `html/style.css` (Notify / Progress / items),
  `html/ui/runtime.js` (panel shell, pages, history, values, actions, patches, ESC),
  `html/ui/components.js` (built-in components), `html/ui/overlays.js` (modal, toasts,
  loading, camera, cinematic, subtitle, choose, caption), `html/ui/ui.css`.
  Lua: `client/ui.lua` (focus manager + exports), `bridge/ui.lua` (the `UI` wrapper).
- Each component: `render(props, ctx) -> Element` and `update(el, props, ctx)` for patches.
  Pages render once; patches only touch components with an `id`.
- Throttling/debouncing of sliders, dials and carousels is built into the component, so
  scripts cannot flood Lua by accident.
- The existing queue in `client/main.lua` (`SendUI` before `ready`) stays and covers the new
  messages too.
- A browser dev mode (open `html/index.html` outside the game) loads `html/dev/dev.js`
  with sample views and fake handlers to design screens without starting the server.
  `html/dev` is not in `fxmanifest.lua`, so it never ships.

---

## 14. Migration plan

| Step | What | Breaks anything? |
|---|---|---|
| 1 ✔ | **Design system in the core:** tokens, fonts, panel, icon sprite, base CSS. Notify/Progress/Items move onto it. | No |
| 2 ✔ | **Runtime + focus manager + Lua API + `UI` in `import.lua`.** Components needed by fks-character: section, text, empty, row, grid, kv, badges, button, segmented, dials, slider, stats, list, cards, input, textarea, select, number, date; modal, toasts, loading, camera stage + rail, Cinematic, Subtitle, Caption, Choose. Verified in the browser dev mode, not yet in game. | No (new exports only) |
| 3 ✔ | **Migrate fks-character** (1.1.0): `html/` and `ui_page` removed, screens rebuilt on `UI` in `selection.lua` / `creator.lua`, intro / photo / train on `UI.Choose` / `UI.Caption` / `UI.Cinematic`. Real views generated from its Lua and checked in the browser, not yet in game. | Needs core 2.1.0 |
| 4 ✔ | **Components for fks-stables:** medals, seals, carousel, ring, facts, tier, chips, timers, kv rating, `round` segmented; `UI.Sheet`, `UI.Pick`, `UI.Minigame('keys')`. Verified with stable-shaped samples in the browser dev mode, not yet in game. | No |
| 5 ✔ | **Migrate fks-stables** (1.3.0): `html/` and `ui_page` removed, menu screens built in the new `client/menu.lua` from `Stable.data`, `stable.lua` keeps the showroom and server calls, horse card on `UI.Sheet`, revive on `UI.Pick`, taming on `UI.Minigame`. Not yet tested in game. | Needs core 2.1.0 |
| 5b ✔ | **Migrate fks-chat** (1.1.0): message feed, input, suggestions, settings and 3D text as an extension (`ui/chat.js` + `ui/chat.css`); `/report` and `/reports` as core screens with `thread` + `composer`. Not yet tested in game. | Needs core 2.1.0 |
| 5c ✔ | **Migrate fks-hud** (1.2.0): HUD and `/hudsettings` as an extension (`ui/hud.js` + `ui/hud.css`), the editor panel rebuilt with core components (`api.render`) in the FKS look. Not yet tested in game. | Needs core 2.1.0 |
| 6 | **Docs:** this file becomes the public reference (README section + examples). Announce. | — |

fks-character goes first because all its NUI calls already go through one file
(`client/ui.lua`), and the stables components build on what it proves.

---

## 15. Coverage check: current screens → components

| Current screen | Built from |
|---|---|
| **Stables · home** | `medals` size `big` (with `img` / `sub` / `badge` / `go`) |
| **Stables · buy horse** | `carousel` big (breed, `keys = 'updown'`, `listAction`) + `carousel` small (coat, `keys = 'leftright'`) + `row{ tier, segmented round }` + `facts` + `stats` (`ticks`) + `text` + `seals` |
| **Stables · my horses** | `carousel` + `text` sub + `badges` + `grid{ ring, kv with rating }` + `stats` (`bar` / `ticks`) + `medals` small (actions with `confirm` / `prompt`) |
| **Stables · breed** | two small `carousel`s + `text` sub + `badges` + `kv` + `button` + `timers` |
| **Stables · wagons** | same set as the horses |
| **Stables · customize (equip, coat, wagon)** | `dials` + `chips` (extras) + `kv` total (patched) + footer buttons |
| **Stables · horse card** | `UI.Sheet` with `tier` + `grid{ ring, kv }` + `stats` |
| **Stables · revive pick / taming** | `UI.Pick` / `UI.Minigame('keys')` |
| **Stables · transfer, breed list** | `prompt` with a `segmented` `list` field |
| **Character · selection** | `list` (expandable rows with `kv` + action buttons, `empty` / `locked` rows) + rename / delete / Tebex `prompt`s |
| **Character · creator tabs** | view `tabs` + `dials` + `slider` / `stats` + footer `buttons` (Random / Reset) + `main` + camera `rail` |
| **Character · identity form** | `grid` of `input`s + `segmented` (gender) + `date` + `slider` (field style) + `textarea`, validated with the `errors` response |
| **Character · intro / kits / photo / train** | `UI.Choose` + `UI.Subtitle`, a `layout = 'center'` page with `cards`, `UI.Caption`, `UI.Cinematic` |
| **Core · admin items** | `tabs` + search `input` + `cards` + `prompt` (`segmented` target, `number` amount) |

Nothing on this list needs an extension.

---

## 16. Risks and open questions

1. ~~**Yielding in cross-resource handlers.**~~ **Tested 2026-10-22, works.** A spike with two
   resources (isolated FXServer, same artifact as the dev server): the "core" stores the
   function reference a "script" passes through an export and calls it later from its own
   thread.

   | Case | Result |
   |---|---|
   | Plain return of a table | ✔ table arrives intact |
   | Handler does `Wait(300)` | ✔ core resumes after ~300 ms with the return value |
   | Handler `Citizen.Await`s a promise (stand-in for a server callback) | ✔ |
   | Handler calls back into a yielding core export (like `Progress`) | ✔ |
   | Two dispatches at once, each in its own thread | ✔ independent, no blocking |
   | Handler throws | `pcall` returns `false`, the error prints in the **script's** console with a stack through the core |
   | Owner stopped, stale reference called | `pcall` returns `false` ("Execution of function reference in script host failed"), no crash |
   | Owner restarted and registered again | ✔ new reference works |

   Things the implementation must respect, learned from the spike:
   - The reference arrives as a **callable table**, not a `function`. Never check
     `type(handler) == 'function'`.
   - Always call it through `pcall` inside a thread, and log `owner` + action name on
     failure, since the error text itself is not returned to the core.
   - Still clear handlers on `onResourceStop`. Do not rely on the stale-call error.

   Caveat: the spike ran on the server runtime. The client uses the same Lua scripting
   runtime and function-reference mechanism, so the result is expected to hold, but it
   gets confirmed in game when fks-character is migrated (step 3).
2. **Message size.** Big pages (e.g. the full item list) are sent once and filtered in the
   NUI, the same as today. Patches cover the frequent updates.
3. **Extensions** load third-party JS into the shared frame, so a broken extension can break
   every FKS UI. Keep them rare, wrap their calls in try/catch, and disable an extension
   whose owner errors on load.
4. **Naming:** `UI` as the global from `import.lua` (globals are per resource, so it only
   clashes inside the importing script; fks-character's own `UI` table goes away in step 3).
5. **Shared orbit camera (Lua)**: both scripts implement one. Worth its own proposal later.
