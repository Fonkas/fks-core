---------------------------------------------------------------------------
-- fks-core bridge: one line in the fxmanifest.lua of a script and it gets the `Bridge`
-- table (VORP / RSG + vorp_inventory / rsg-inventory / ox_inventory) on the server and the client,
-- plus the `UI` table on the client (shared FKS interface, see docs/UI-API.md).
--
--   shared_script '@fks-core/import.lua'
--
-- The bridge code runs inside the script that imports it, so callbacks and returned tables work
-- like local code. Optional settings read from the script's own Config (all have defaults):
--   Config.Framework       'auto' | 'vorp' | 'rsg'
--   Config.Inventory       'auto' | 'ox_inventory' | 'rsg-inventory' | 'vorp_inventory'
--   Config.RSGGoldAccount  rsg-core money account used as "gold" (nil = no gold on RSG)
--   Config.AdminGroups     groups / permissions allowed by Bridge.IsAdmin (default admin, superadmin)
-- Minimum fks-core version (optional, in the script's fxmanifest.lua):  fks_core_version '2.0.0'
---------------------------------------------------------------------------
local CORE = 'fks-core'
local resource = GetCurrentResourceName()
local side = IsDuplicityVersion() and 'server' or 'client'

if resource ~= CORE then
    local state = GetResourceState(CORE)
    if state ~= 'started' and state ~= 'starting' then
        print(('^1[%s] fks-core is not running (%s). Download: https://github.com/Fonkas/fks-core^0'):format(resource, state))
        print(('^1[%s] add ^3ensure fks-core^1 before ^3ensure %s^1 in server.cfg^0'):format(resource, resource))
        return
    end
end

local files = { 'bridge/shared.lua', ('bridge/%s.lua'):format(side) }
if side == 'client' then files[#files + 1] = 'bridge/ui.lua' end   -- the `UI` table (docs/UI-API.md)

for _, file in ipairs(files) do
    local code = LoadResourceFile(CORE, file)
    if not code then
        print(('^1[%s] could not read @fks-core/%s - update fks-core^0'):format(resource, file))
        return
    end
    local fn, err = load(code, ('@@%s/%s'):format(CORE, file), 't', _ENV)
    if not fn then error(('[%s] @fks-core/%s: %s'):format(resource, file, err), 0) end
    fn()
end
