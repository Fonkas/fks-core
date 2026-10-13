---------------------------------------------------------------------------
-- fks-utils bridge: one line in the fxmanifest.lua of a script and it gets the `Bridge`
-- table (VORP / RSG + vorp_inventory / rsg-inventory / ox_inventory) on the server and the client.
--
--   shared_script '@fks-utils/import.lua'
--
-- The bridge code runs inside the script that imports it, so callbacks and returned tables work
-- like local code. Optional settings read from the script's own Config (all have defaults):
--   Config.Framework       'auto' | 'vorp' | 'rsg'
--   Config.Inventory       'auto' | 'ox_inventory' | 'rsg-inventory' | 'vorp_inventory'
--   Config.RSGGoldAccount  rsg-core money account used as "gold" (nil = no gold on RSG)
--   Config.AdminGroups     groups / permissions allowed by Bridge.IsAdmin (default admin, superadmin)
-- Minimum fks-utils version (optional, in the script's fxmanifest.lua):  fks_utils_version '1.1.0'
---------------------------------------------------------------------------
local UTILS = 'fks-utils'
local resource = GetCurrentResourceName()
local side = IsDuplicityVersion() and 'server' or 'client'

if resource ~= UTILS then
    local state = GetResourceState(UTILS)
    if state ~= 'started' and state ~= 'starting' then
        print(('^1[%s] fks-utils is not running (%s). Download: https://github.com/Fonkas/fks-utils^0'):format(resource, state))
        print(('^1[%s] add ^3ensure fks-utils^1 before ^3ensure %s^1 in server.cfg^0'):format(resource, resource))
        return
    end
end

for _, file in ipairs({ 'bridge/shared.lua', ('bridge/%s.lua'):format(side) }) do
    local code = LoadResourceFile(UTILS, file)
    if not code then
        print(('^1[%s] could not read @fks-utils/%s - update fks-utils^0'):format(resource, file))
        return
    end
    local fn, err = load(code, ('@@%s/%s'):format(UTILS, file), 't', _ENV)
    if not fn then error(('[%s] @fks-utils/%s: %s'):format(resource, file, err), 0) end
    fn()
end
