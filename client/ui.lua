---------------------------------------------------------------------------
-- Shared UI: fks-core owns the only NUI frame. Scripts describe a screen, fks-core draws it and
-- hands the clicks back to the script that opened it. Full reference: docs/UI-API.md
--
-- Scripts normally use the `UI` table from @fks-core/import.lua (bridge/ui.lua):
--   UI.On('buy', function(d) ... return { toast = { text = 'Bought!' } } end)
--   UI.Open({ title = 'Stable', body = { ... } })
--
-- fks-core is the only resource that calls SetNuiFocus for these screens. One resource owns the
-- panel at a time; another one trying to open it gets false, 'busy'.
---------------------------------------------------------------------------
local menu = nil        -- { owner, handler, opts, hidden, closing }
local blocking = nil    -- { owner, kind, p, onChange }  (UIChoose)
local modals = {}       -- id -> { owner, p, alone }      (UIConfirm / UIPrompt)
local modalSeq = 0
local sheets = {}       -- owner -> sheet id              (UISheet)
local exts = {}         -- owner -> { handler, focus }    (UIExtend: a script's own JS/CSS inside this NUI)

local LOOK = { 0xA987235F, 0xD2047988 }                                  -- look around
local ATTACK = { 0x07CE1E61, 0xF84FA74F, 0xB2F377E8, 0xAC4BD4F1 }       -- attack, aim, melee, weapon wheel

local function Owner()
    return GetInvokingResource() or GetCurrentResourceName()
end

-- ends a picker once (Choose / Pick / Minigame); `done` also stops its refresh loop
local function Resolve(b, value)
    if not b or b.done then return end
    b.done = true
    b.p:resolve(value)
end

local function Busy(owner)
    return (menu and menu.owner ~= owner) or (blocking and blocking.owner ~= owner)
end

-- Works out who needs the focus right now and applies it.
local function Refocus()
    local want, cursor, keep = false, false, false
    if blocking then
        want, cursor = true, true
    elseif menu and not menu.hidden then
        want, cursor, keep = true, menu.opts.cursor ~= false, menu.opts.keepInput == true
    end
    for _, m in pairs(modals) do
        if m.alone then want, cursor, keep = true, true, false end
    end
    if not want then
        for _, e in pairs(exts) do
            if e.focus then want, cursor, keep = true, e.cursor ~= false, false end
        end
    end
    SetNuiFocus(want, cursor)
    SetNuiFocusKeepInput(want and keep)
    TriggerEvent('fks-core:ui:focus', want)
end

-- The handler is the function reference the script passed to UIOpen. It arrives as a callable
-- table, may yield, and its errors print in the script's own console.
local function Call(owner, handler, action, data)
    if not handler then return true, nil end
    local ok, res = pcall(handler, action, data)
    if not ok then
        print(('^1[fks-core] %s: UI action \'%s\' failed (error above, in the %s console)^0'):format(owner, tostring(action), owner))
        return false, nil
    end
    return true, res
end

local function Finish(reason)
    if not menu then return end
    local owner = menu.owner
    if menu.hidRadar then DisplayRadar(true) end
    menu = nil
    SendUI('ui:close', { reason = reason })
    Refocus()
    LocalPlayer.state:set('fksUI', nil, false)
    TriggerEvent('fks-core:ui:closed', owner, reason)
end

-- Close asked by the player or the game (ESC, close button, death). The owner can say no.
local function RequestClose(reason)
    local m = menu
    if not m then return true end
    m.closing = true
    local ok, res = Call(m.owner, m.handler, 'close', { reason = reason })
    if menu ~= m then return true end           -- the handler already closed or replaced it
    if ok and res == false then
        m.closing = false
        return false
    end
    Finish(reason)
    return true
end

local function Watch()
    CreateThread(function()
        local paused, dead = false, false
        while menu do
            local m = menu
            if m.opts.keepInput then
                for _, c in ipairs(LOOK) do DisableControlAction(0, c, true) end
                for _, c in ipairs(ATTACK) do DisableControlAction(0, c, true) end
            end
            local p = IsPauseMenuActive()
            if p ~= paused then
                paused = p
                m.hidden = p
                SendUI('ui:hidden', { on = p })
                Refocus()
            end
            local d = IsEntityDead(PlayerPedId())
            if d and not dead and m.opts.closeOnDeath ~= false then
                CreateThread(function() RequestClose('death') end)
            end
            dead = d
            Wait(m.opts.keepInput and 0 or 250)
        end
    end)
end

---------------------------------------------------------------------------
-- Menu (the main panel)
---------------------------------------------------------------------------
function UIOpen(view, opts, handler)
    local owner = Owner()
    if Busy(owner) then return false, 'busy' end
    if type(view) ~= 'table' then return false, 'invalid_view' end
    opts = type(opts) == 'table' and opts or {}

    local fresh = menu == nil
    local hidRadar = menu and menu.hidRadar or false
    if fresh and opts.hideHud then
        DisplayRadar(false)
        hidRadar = true
    end
    menu = { owner = owner, handler = handler, opts = opts, hidden = false, hidRadar = hidRadar }

    SendUI('ui:open', {
        owner = owner,
        view = view,
        fresh = fresh,
        opts = { closable = opts.closable ~= false, position = opts.position },
    })
    Refocus()
    if fresh then
        Watch()
        LocalPlayer.state:set('fksUI', owner, false)
        TriggerEvent('fks-core:ui:opened', owner)
    end
    return true
end

local function Mine()
    return menu and menu.owner == Owner()
end

function UIUpdate(view)
    if Mine() and type(view) == 'table' then SendUI('ui:update', { view = view }) end
end

function UISetPage(id, page)
    if Mine() and type(page) == 'table' then SendUI('ui:page', { id = id, page = page }) end
end

function UIPatch(a, b)
    if not Mine() then return end
    local patches = type(a) == 'table' and a or { [a] = b }
    SendUI('ui:patch', { patches = patches })
end

function UIGo(pageId)
    if Mine() then SendUI('ui:go', { id = pageId }) end
end

function UIClose()
    if not Mine() then return end
    if menu.closing then return Finish('script') end   -- called from inside its own 'close' handler
    menu.closing = true
    Call(menu.owner, menu.handler, 'close', { reason = 'script' })
    Finish('script')
end

function UIIsOpen()
    return menu ~= nil, menu and menu.owner or nil
end

RegisterNUICallback('ui:action', function(d, cb)
    local m = menu
    if not m or type(d) ~= 'table' or type(d.action) ~= 'string' then return cb({ ok = false }) end
    CreateThread(function()
        local ok, res = Call(m.owner, m.handler, d.action, type(d.data) == 'table' and d.data or {})
        if not ok then return cb({ ok = false }) end
        if type(res) ~= 'table' then res = {} end
        if res.close and menu == m then
            m.closing = true
            Finish('script')
        end
        cb(res)
    end)
end)

RegisterNUICallback('ui:close', function(d, cb)
    local reason = type(d) == 'table' and d.reason or 'esc'
    CreateThread(function() cb({ closed = RequestClose(reason) }) end)
end)

---------------------------------------------------------------------------
-- Dialogs (block until the player answers)
---------------------------------------------------------------------------
local function Modal(kind, data)
    local owner = Owner()
    if Busy(owner) then return nil end
    modalSeq = modalSeq + 1
    local id = modalSeq
    local p = promise.new()
    modals[id] = { owner = owner, p = p, alone = menu == nil }
    data.id, data.kind = id, kind
    SendUI('ui:modal', data)
    Refocus()
    return Citizen.Await(p)
end

function UIConfirm(o)
    local r = Modal('confirm', type(o) == 'table' and o or { text = tostring(o or '') })
    return type(r) == 'table' and r.ok == true
end

function UIPrompt(o)
    local r = Modal('prompt', type(o) == 'table' and o or {})
    if type(r) == 'table' and r.ok then return r.values or {} end
end

RegisterNUICallback('ui:modal', function(d, cb)
    cb('ok')
    local m = type(d) == 'table' and modals[d.id]
    if not m then return end
    modals[d.id] = nil
    Refocus()
    m.p:resolve(d)
end)

---------------------------------------------------------------------------
-- Overlays (no focus)
---------------------------------------------------------------------------
function UILoading(text)
    SendUI('ui:loading', { text = text ~= false and text ~= nil and tostring(text) or nil, on = text ~= false and text ~= nil })
end

function UIToast(text, kind)
    if text then SendUI('ui:toast', { text = tostring(text), type = kind or 'inform' }) end
end

function UICinematic(o)
    if type(o) ~= 'table' then return SendUI('ui:cinematic', { on = false }) end
    o.on = true
    SendUI('ui:cinematic', o)
end

function UISubtitle(text, ms)
    SendUI('ui:subtitle', { text = text and tostring(text) or nil, ms = tonumber(ms) })
end

function UICaption(o)
    if type(o) ~= 'table' then return SendUI('ui:caption', { on = false }) end
    o.on = true
    SendUI('ui:caption', o)
end

---------------------------------------------------------------------------
-- Blocking pickers (take the focus, the owner's menu hides meanwhile)
---------------------------------------------------------------------------
-- UIChoose(false) ends the caller's open picker (its UIChoose returns nil)
function UIChoose(opts, onChange)
    local owner = Owner()
    if opts == false then
        if blocking and blocking.owner == owner then Resolve(blocking, nil) end
        return nil
    end
    if blocking or Busy(owner) or type(opts) ~= 'table' then return nil end
    local p = promise.new()
    blocking = { owner = owner, kind = 'choose', p = p, onChange = onChange }
    if menu then SendUI('ui:suspend', { on = true }) end
    opts.on = true
    SendUI('ui:choose', opts)
    Refocus()
    local value = Citizen.Await(p)
    blocking = nil
    SendUI('ui:choose', { on = false })
    if menu then SendUI('ui:suspend', { on = false }) end
    Refocus()
    return value
end

RegisterNUICallback('ui:choose', function(d, cb)
    cb('ok')
    local b = blocking
    if not b or b.kind ~= 'choose' or type(d) ~= 'table' then return end
    if d.done then
        Resolve(b, d.value)
    elseif b.onChange then
        CreateThread(function() Call(b.owner, b.onChange, d.value) end)
    end
end)

-- Shared runner for UIPick / UIMinigame: takes the focus (hiding the owner's menu), runs `loop`
-- while it is open and returns the value sent by the NUI (ui:block) or by a cancel.
local function RunBlocking(owner, kind, start, stop, loop)
    if blocking or Busy(owner) then return nil end
    local b = { owner = owner, kind = kind, p = promise.new() }
    blocking = b
    if menu then SendUI('ui:suspend', { on = true }) end
    start()
    Refocus()
    if loop then
        CreateThread(function()
            while blocking == b and not b.done do loop(b) end
        end)
    end
    local value = Citizen.Await(b.p)
    blocking = nil
    stop()
    if menu then SendUI('ui:suspend', { on = false }) end
    Refocus()
    return value
end

local function CancelBlocking(owner, kind, value)
    if blocking and blocking.owner == owner and blocking.kind == kind then Resolve(blocking, value) end
end

RegisterNUICallback('ui:block', function(d, cb)
    cb('ok')
    local b = blocking
    if not b or type(d) ~= 'table' or not d.done or (d.kind and d.kind ~= b.kind) then return end
    Resolve(b, d.value)
end)

-- UIPick(opts, getPoints?) -> id | nil
--   opts = { hint, timeout (s), refresh (ms, default 100), points }
--   getPoints() -> { { id, coords = vector3 | entity = handle, label? } } runs on every refresh, so the
--   list can change (return nil / {} to cancel). Points off screen are hidden. UIPick(false) cancels.
function UIPick(opts, getPoints)
    local owner = Owner()
    if opts == false then return CancelBlocking(owner, 'pick', nil) end
    opts = type(opts) == 'table' and opts or {}
    local limit = tonumber(opts.timeout) and GetGameTimer() + opts.timeout * 1000 or nil
    local refresh = tonumber(opts.refresh) or 100
    return RunBlocking(owner, 'pick', function() end, function() SendUI('ui:pick', { on = false }) end, function(b)
        local pts = opts.points
        if getPoints then
            local ok, res = pcall(getPoints)
            pts = ok and res or nil
        end
        if type(pts) ~= 'table' or #pts == 0 or (limit and GetGameTimer() > limit) or IsEntityDead(PlayerPedId()) then
            return Resolve(b, nil)
        end
        local dots = {}
        for _, pt in ipairs(pts) do
            local c = pt.coords
            if not c and pt.entity and DoesEntityExist(pt.entity) then c = GetEntityCoords(pt.entity) end
            if c then
                local on, x, y = GetScreenCoordFromWorldCoord(c.x, c.y, c.z)
                if on then dots[#dots + 1] = { id = pt.id, x = x, y = y, label = pt.label } end
            end
        end
        SendUI('ui:pick', { on = true, dots = dots, hint = opts.hint })
        Wait(refresh)
    end)
end

-- UIMinigame('keys', { duration, fallTime, spawnEvery, spawnEveryEnd, letters }) -> bool
-- (times in ms). UIMinigame(false) stops it from Lua (it returns false).
function UIMinigame(kind, opts)
    local owner = Owner()
    if kind == false then return CancelBlocking(owner, 'minigame', false) end
    if kind ~= 'keys' then return false end
    opts = type(opts) == 'table' and opts or {}
    opts.on, opts.kind = true, kind
    local r = RunBlocking(owner, 'minigame',
        function() SendUI('ui:minigame', opts) end,
        function() SendUI('ui:minigame', { on = false }) end)
    return r == true
end

---------------------------------------------------------------------------
-- Sheet: side card without focus (fks-stables horse card). One on screen at a time.
--   UISheet('horse', { eyebrow, title, subtitle, body = { components }, hints, position = 'right' })
--   UISheet('horse', false)   -- hides it (calling again with the same id refreshes it in place)
---------------------------------------------------------------------------
function UISheet(id, view)
    local owner = Owner()
    if type(view) ~= 'table' then
        if sheets[owner] ~= nil and (id == nil or id == false or sheets[owner] == id) then
            sheets[owner] = nil
            SendUI('ui:sheet', { on = false, owner = owner, id = id })
        end
        return
    end
    sheets[owner] = id
    SendUI('ui:sheet', { on = true, owner = owner, id = id, view = view })
end

---------------------------------------------------------------------------
-- Extensions: a script loads its own JS / CSS into this NUI (still one frame on the server).
-- For screens that are not menus, e.g. the fks-chat message feed. The script's JS registers with
-- FKS.extension(owner, { messages = { ... } }) and talks to its Lua through api.call / UIExtSend.
--   UIExtend({ js = 'ui/chat.js', css = 'ui/chat.css' }, handler)   -- paths inside the calling resource
--   UIExtSend(action, data)        -- Lua -> the script's JS
--   UIExtFocus(true | false, cursor?)  -- the extension takes / gives back the mouse and keyboard
---------------------------------------------------------------------------
function UIExtend(files, handler)
    local owner = Owner()
    if type(files) ~= 'table' or not files.js then return false end
    local prev = exts[owner]
    exts[owner] = { handler = handler, focus = prev and prev.focus or false }
    -- the files are read here and sent as text: the page injects them directly, so no cross-resource
    -- request (that RedM's browser may refuse, e.g. stylesheets) is involved. URLs stay as a fallback.
    local text = function(path) return path and LoadResourceFile(owner, path) or nil end
    local url = function(path) return path and ('https://cfx-nui-%s/%s'):format(owner, path) or nil end
    local jsText, cssText = text(files.js), text(files.css)
    if not jsText then print(('^3[fks-core] %s: could not read %s for its extension (is it in its fxmanifest files?)^0'):format(owner, files.js)) end
    if files.css and not cssText then print(('^3[fks-core] %s: could not read %s for its extension^0'):format(owner, files.css)) end
    SendUI('ui:extend', { owner = owner, jsText = jsText, cssText = cssText, js = url(files.js), css = url(files.css) })
    return true
end

function UIExtSend(action, data)
    local owner = Owner()
    if exts[owner] then SendUI('ui:ext', { owner = owner, action = action, data = data }) end
end

function UIExtFocus(on, cursor)
    local e = exts[Owner()]
    if not e then return end
    e.focus, e.cursor = on == true, cursor
    Refocus()
end

-- true while any FKS screen holds the mouse / keyboard (menu, dialog, picker or extension)
function UIHasFocus()
    if menu or blocking or next(modals) then return true end
    for _, e in pairs(exts) do if e.focus then return true end end
    return false
end

RegisterNUICallback('ui:ext', function(d, cb)
    local e = type(d) == 'table' and exts[d.owner]
    if not e or type(d.name) ~= 'string' then return cb({}) end
    CreateThread(function()
        local ok, res = Call(d.owner, e.handler, d.name, type(d.data) == 'table' and d.data or {})
        cb(ok and type(res) == 'table' and res or {})
    end)
end)

RegisterNUICallback('ui:extfocus', function(d, cb)
    cb('ok')
    local e = type(d) == 'table' and exts[d.owner]
    if not e then return end
    e.focus = d.on == true
    Refocus()
end)

---------------------------------------------------------------------------
-- Cleanup: everything a resource owns goes away with it
---------------------------------------------------------------------------
AddEventHandler('onClientResourceStop', function(res)
    if res == GetCurrentResourceName() then
        SetNuiFocus(false, false)
        return
    end
    if menu and menu.owner == res then Finish('stop') end
    if sheets[res] ~= nil then
        sheets[res] = nil
        SendUI('ui:sheet', { on = false, owner = res })
    end
    if exts[res] then
        exts[res] = nil
        SendUI('ui:ext:remove', { owner = res })
    end
    if blocking and blocking.owner == res then Resolve(blocking, nil) end
    for id, m in pairs(modals) do
        if m.owner == res then
            modals[id] = nil
            SendUI('ui:modal', { id = id, kind = 'close' })
            m.p:resolve({ ok = false })
        end
    end
    Refocus()
end)

exports('UIOpen', UIOpen)
exports('UIUpdate', UIUpdate)
exports('UISetPage', UISetPage)
exports('UIPatch', UIPatch)
exports('UIGo', UIGo)
exports('UIClose', UIClose)
exports('UIIsOpen', UIIsOpen)
exports('UIConfirm', UIConfirm)
exports('UIPrompt', UIPrompt)
exports('UILoading', UILoading)
exports('UIToast', UIToast)
exports('UICinematic', UICinematic)
exports('UISubtitle', UISubtitle)
exports('UICaption', UICaption)
exports('UIChoose', UIChoose)
exports('UIPick', UIPick)
exports('UIMinigame', UIMinigame)
exports('UISheet', UISheet)
exports('UIExtend', UIExtend)
exports('UIExtSend', UIExtSend)
exports('UIExtFocus', UIExtFocus)
exports('UIHasFocus', UIHasFocus)
