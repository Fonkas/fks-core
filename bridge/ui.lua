---------------------------------------------------------------------------
-- `UI` for scripts (client). Loaded by @fks-core/import.lua and runs inside the script that
-- imports it, so UI.On handlers are local functions of that script. Reference: docs/UI-API.md
--
--   UI.On('buy', function(d) return { toast = { text = 'Bought!' } } end)
--   UI.On('close', function(d) ... end)        -- d.reason: esc | button | script | death | stop
--   UI.Open({ title = 'Stable', body = { { type = 'text', text = 'Hello' } } })
---------------------------------------------------------------------------
UI = {}

local CORE = 'fks-core'
local handlers = {}

-- Tables cross to fks-core as JSON: the msgpack between resources drops anything nested more than
-- 16 tables deep (a select inside a prompt inside a list row arrived empty). fks-core unpacks it.
local function Pack(t)
    if type(t) ~= 'table' then return t end
    local ok, s = pcall(json.encode, t)
    return ok and { __json = s } or t
end

-- One dispatcher for every action of this script: fks-core calls it with (action, data).
local function Dispatch(action, data)
    local fn = handlers[action]
    if fn then return Pack(fn(data)) end
end

local function core()
    return exports[CORE]
end

function UI.On(action, fn) handlers[action] = fn end
function UI.Off(action) handlers[action] = nil end

-- Menu
function UI.Open(view, opts) return core():UIOpen(Pack(view), opts or {}, Dispatch) end
function UI.Update(view) core():UIUpdate(Pack(view)) end
function UI.SetPage(id, page) core():UISetPage(id, Pack(page)) end
function UI.Patch(a, b) core():UIPatch(Pack(a), Pack(b)) end
function UI.Go(pageId) core():UIGo(pageId) end
function UI.Close() core():UIClose() end
function UI.IsOpen() return core():UIIsOpen() end

-- Dialogs (block until answered)
function UI.Confirm(o) return core():UIConfirm(Pack(o)) end
function UI.Prompt(o) return core():UIPrompt(Pack(o)) end

-- Overlays
function UI.Loading(text) core():UILoading(text) end
function UI.Toast(text, kind) core():UIToast(text, kind) end
function UI.Cinematic(o) core():UICinematic(o) end
function UI.Subtitle(text, ms) core():UISubtitle(text, ms) end
function UI.Caption(o) core():UICaption(o) end
function UI.Tracker(o) core():UITracker(o) end   -- small top-centre box: { label, seconds, bar = { value, label, tone } } | false

-- Side card without focus (one at a time); UI.Sheet(id, false) hides it
function UI.Sheet(id, view) core():UISheet(id, Pack(view)) end

-- Blocking pickers (take the focus until answered)
function UI.Choose(o, onChange) return core():UIChoose(o, onChange) end   -- value; onChange(value) while browsing
function UI.Pick(o, getPoints) return core():UIPick(o, getPoints) end     -- point id or nil
function UI.Minigame(kind, o) return core():UIMinigame(kind, o) end       -- true = passed

-- Extension: this script's own JS / CSS inside the fks-core NUI (for screens that are not menus)
--   UI.Extend({ js = 'ui/chat.js', css = 'ui/chat.css' })   -- the JS calls api.call(name, data) -> UI.OnExt(name)
local extHandlers, extFiles = {}, nil
local function ExtDispatch(name, data)
    local fn = extHandlers[name]
    if fn then return fn(data) end
end
function UI.Extend(files) extFiles = files; return core():UIExtend(files, ExtDispatch) end
function UI.OnExt(name, fn) extHandlers[name] = fn end
function UI.ExtSend(action, data) core():UIExtSend(action, data) end
function UI.ExtFocus(on, cursor) core():UIExtFocus(on, cursor) end
function UI.HasFocus() return core():UIHasFocus() end

-- fks-core restarted: its NUI is gone, so tell the script its panel closed
AddEventHandler('onClientResourceStop', function(res)
    if res == CORE and handlers.close then
        CreateThread(function() handlers.close({ reason = 'stop' }) end)
    end
end)

-- ... and load the extension again when it is back
AddEventHandler('onClientResourceStart', function(res)
    if res == CORE and extFiles then
        CreateThread(function()
            Wait(500)
            core():UIExtend(extFiles, ExtDispatch)
            if extHandlers.restart then extHandlers.restart({}) end
        end)
    end
end)
