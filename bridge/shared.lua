---------------------------------------------------------------------------
-- Bridge (shared): framework / inventory detection.
-- Runs inside the script that imports it (@fks-utils/import.lua) and inside fks-utils itself.
-- The framework and the inventory may start AFTER the script (fks-utils is a dependency, so it starts
-- before vorp_core / rsg-core): detection runs on use, not at load, and is cached once something is found.
---------------------------------------------------------------------------
Bridge = Bridge or {}
Bridge.resource = GetCurrentResourceName()

function Bridge.Started(res)
    local state = GetResourceState(res)
    return state == 'started' or state == 'starting'
end

-- setting from the script's Config (nil when the script has no Config or no such key)
function Bridge.Setting(key, default)
    local cfg = rawget(_G, 'Config')
    local v = type(cfg) == 'table' and cfg[key] or nil
    if v == nil then return default end
    return v
end

local INVENTORIES = {
    ox = 'ox_inventory', ox_inventory = 'ox_inventory',
    rsg = 'rsg-inventory', ['rsg-inventory'] = 'rsg-inventory',
    vorp = 'vorp_inventory', vorp_inventory = 'vorp_inventory',
}

-- 'rsg' | 'vorp' | nil
function Bridge.Framework()
    if Bridge.framework then return Bridge.framework end
    local f = tostring(Bridge.Setting('Framework', 'auto')):lower()
    if f ~= 'rsg' and f ~= 'vorp' then
        f = (Bridge.Started('rsg-core') and 'rsg') or (Bridge.Started('vorp_core') and 'vorp') or nil
    end
    Bridge.framework = f
    return f
end

-- 'ox_inventory' | 'rsg-inventory' | 'vorp_inventory' | nil
function Bridge.Inventory()
    if Bridge.inventory then return Bridge.inventory end
    local i = INVENTORIES[tostring(Bridge.Setting('Inventory', 'auto')):lower()]
    if not i then
        i = (Bridge.Started('ox_inventory') and 'ox_inventory')
            or (Bridge.Started('rsg-inventory') and 'rsg-inventory')
            or (Bridge.Started('vorp_inventory') and 'vorp_inventory') or nil
    end
    Bridge.inventory = i
    return i
end
Bridge.Inv = Bridge.Inventory

-- '1.2.10' -> { 1, 2, 10 }
local function parse(v)
    local parts = {}
    for n in tostring(v):gsub('^[vV]', ''):gmatch('%d+') do parts[#parts + 1] = tonumber(n) end
    return parts
end

-- is version a newer than version b?
function Bridge.IsNewer(a, b)
    local x, y = parse(a), parse(b)
    for i = 1, math.max(#x, #y) do
        local p, q = x[i] or 0, y[i] or 0
        if p ~= q then return p > q end
    end
    return false
end

-- fks_utils_version 'x.y.z' in the script's fxmanifest.lua: warns when the installed fks-utils is older
if IsDuplicityVersion() and Bridge.resource ~= 'fks-utils' then
    local need = GetResourceMetadata(Bridge.resource, 'fks_utils_version', 0)
    local have = GetResourceMetadata('fks-utils', 'version', 0) or '0.0.0'
    if need and Bridge.IsNewer(need, have) then
        print(('^1[%s] needs fks-utils %s or newer (installed: %s). Download: https://github.com/Fonkas/fks-utils^0'):format(Bridge.resource, need, have))
    end
end
