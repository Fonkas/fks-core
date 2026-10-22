---------------------------------------------------------------------------
-- /items panel (server): admin check, item catalogue and giving.
-- Framework / inventory / players come from the shared bridge (bridge/server.lua).
---------------------------------------------------------------------------
local RSG = Bridge.RSG

-- VORP groups / RSG permission from Config.Items, plus the Config.Items.ace ACE
function Bridge.IsItemsAdmin(src)
    if src == 0 then return false end -- the panel needs a player
    local cfg = Config.Items
    local groups = Bridge.Framework() == 'rsg' and { cfg.rsgPermission or 'admin' } or (cfg.vorpGroups or { 'admin' })
    return Bridge.IsAdmin(src, groups, cfg.ace)
end

---------------------------------------------------------------------------
-- Item catalogue: { name, label, kind = 'item' | 'weapon' | 'ammo', desc, weight, image, image2 }
---------------------------------------------------------------------------
-- runs a shared config file of another resource (vorp_inventory/config/weapons.lua...) in a sandbox
local function LoadShared(res, file)
    local code = LoadResourceFile(res, file)
    if not code then return {} end
    local env = setmetatable({ SharedData = {} }, { __index = _G })
    local fn = load(code, ('@%s/%s'):format(res, file), 't', env)
    if fn then pcall(fn) end
    return env.SharedData or {}
end

local function Img(default, name, image)
    local path = Config.Items.imagePath or default
    return (path:gsub('{name}', name):gsub('{image}', image or (name .. '.png')))
end

local function VorpCatalogue()
    local list = {}
    local base = 'nui://vorp_inventory/html/img/items/{name}.png'

    for _, row in ipairs(MySQL.query.await('SELECT * FROM items') or {}) do
        list[#list + 1] = {
            name = row.item, label = row.label or row.item, kind = 'item',
            desc = row.desc, weight = row.weight, image = Img(base, row.item),
        }
    end

    local shared = LoadShared('vorp_inventory', 'config/weapons.lua')
    for key, w in pairs(shared.Weapons or {}) do
        local name = (w.HashName or key):upper()
        list[#list + 1] = {
            name = name, label = w.Name or name, kind = 'weapon', desc = w.Desc, weight = w.Weight,
            image = Img(base, name:lower()), image2 = Img(base, name),
        }
    end

    local ammo = LoadShared('vorp_inventory', 'config/ammo.lua')
    for key, label in pairs(ammo.AmmoLabels or {}) do
        list[#list + 1] = {
            name = key, label = label, kind = 'ammo',
            image = Img(base, key:lower()), image2 = Img(base, key),
        }
    end
    return list
end

local function RsgCatalogue()
    local list = {}
    local base = 'nui://rsg-inventory/html/images/{image}'
    for name, it in pairs(RSG().Shared.Items or {}) do
        local kind = it.type == 'weapon' and 'weapon' or (name:sub(1, 5):lower() == 'ammo_' and 'ammo') or 'item'
        list[#list + 1] = {
            name = name, label = it.label or name, kind = kind, desc = it.description, weight = it.weight,
            image = Img(base, name, it.image),
        }
    end
    return list
end

local function OxCatalogue()
    local list = {}
    local base = 'nui://ox_inventory/web/images/{image}'
    for name, it in pairs(exports.ox_inventory:Items() or {}) do
        local upper = name:upper()
        local kind = (upper:sub(1, 7) == 'WEAPON_' and 'weapon') or (upper:sub(1, 5) == 'AMMO-' and 'ammo') or 'item'
        local image = it.client and it.client.image
        list[#list + 1] = {
            name = name, label = it.label or name, kind = kind, desc = it.description, weight = it.weight,
            image = image and image:find('://') and image or Img(base, name, image),
        }
    end
    return list
end

function Bridge.Catalogue()
    local inv = ({ ox_inventory = 'ox', vorp_inventory = 'vorp', ['rsg-inventory'] = 'rsg' })[Bridge.Inventory() or '']
    local ok, list
    if inv == 'ox' then ok, list = pcall(OxCatalogue)
    elseif inv == 'vorp' then ok, list = pcall(VorpCatalogue)
    elseif inv == 'rsg' then ok, list = pcall(RsgCatalogue)
    else return {} end
    if not ok then
        print(('^1[fks-core] could not read the item list (%s): %s^0'):format(inv, tostring(list)))
        return {}
    end
    table.sort(list, function(a, b) return (a.label or ''):lower() < (b.label or ''):lower() end)
    return list
end

---------------------------------------------------------------------------
-- Giving. Returns ok, errorKey
---------------------------------------------------------------------------
local function RandomSerial()
    local s = ''
    for _ = 1, 3 do s = s .. string.char(math.random(65, 90)) end
    return s .. math.random(10000, 99999)
end

local Give = {}

function Give.vorp(target, entry, amount)
    local Inv = exports.vorp_inventory
    if entry.kind == 'item' then
        if Inv:canCarryItem(target, entry.name, amount) == false then return false, 'cant_carry' end
        return Inv:addItem(target, entry.name, amount) ~= false
    elseif entry.kind == 'weapon' then
        if Inv:canCarryWeapons(target, amount, nil, entry.name) == false then return false, 'cant_carry' end
        for _ = 1, amount do Inv:createWeapon(target, entry.name, {}, {}) end
        return true
    elseif entry.kind == 'ammo' then
        return Inv:addBullets(target, entry.name, amount) ~= false
    end
    return false
end

function Give.rsg(target, entry, amount)
    local Player = RSG().Functions.GetPlayer(target)
    if not Player then return false end
    if Bridge.Started('rsg-inventory') then
        local ok, can = pcall(function() return exports['rsg-inventory']:CanAddItem(target, entry.name, amount) end)
        if ok and can == false then return false, 'cant_carry' end
    end
    local item = RSG().Shared.Items[entry.name]
    if entry.kind == 'weapon' then
        for _ = 1, amount do
            if not Player.Functions.AddItem(entry.name, 1, false, { serie = RandomSerial(), quality = 100 }) then return false end
        end
    elseif not Player.Functions.AddItem(entry.name, amount) then
        return false
    end
    TriggerClientEvent('rsg-inventory:client:ItemBox', target, item, 'add', amount)
    return true
end

function Give.ox(target, entry, amount)
    if exports.ox_inventory:CanCarryItem(target, entry.name, amount) == false then return false, 'cant_carry' end
    return exports.ox_inventory:AddItem(target, entry.name, amount) == true
end

function Bridge.Give(target, entry, amount)
    local fn = Give[({ ox_inventory = 'ox', vorp_inventory = 'vorp', ['rsg-inventory'] = 'rsg' })[Bridge.Inventory() or '']]
    if not fn then return false end
    local ok, res, err = pcall(fn, target, entry, amount)
    if not ok then
        print(('^1[fks-core] give failed: %s^0'):format(tostring(res)))
        return false
    end
    return res, err
end
