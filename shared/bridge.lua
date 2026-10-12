---------------------------------------------------------------------------
-- Framework / inventory detection (shared)
-- fks-utils is a dependency, so it usually starts BEFORE vorp_core / rsg-core:
-- detection runs on first use (not at load) and is cached once something is found.
---------------------------------------------------------------------------
function Started(name)
    local state = GetResourceState(name)
    return state == 'started' or state == 'starting'
end

local framework, inventory

function GetFramework()
    if framework then return framework end
    local f = (Config.Framework or 'auto'):lower()
    if f ~= 'rsg' and f ~= 'vorp' then
        f = (Started('rsg-core') and 'rsg') or (Started('vorp_core') and 'vorp') or 'none'
    end
    if f ~= 'none' then framework = f end
    return f
end

function GetInventory()
    if inventory then return inventory end
    local i = (Config.Inventory or 'auto'):lower()
    if i ~= 'ox' and i ~= 'vorp' and i ~= 'rsg' then
        i = (Started('ox_inventory') and 'ox') or GetFramework()
    end
    if i ~= 'none' then inventory = i end
    return i
end
