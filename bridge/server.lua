---------------------------------------------------------------------------
-- Bridge (server): players, money, permissions, items, storages, notifications and version check
-- for VORP / RSG with vorp_inventory / rsg-inventory / ox_inventory. Everything a script needs from
-- the framework goes through here, so supporting a framework change is done once, in fks-utils.
---------------------------------------------------------------------------
Bridge = Bridge or {}

local cores = {}

-- framework core objects (nil until that framework is running)
local function RSG()
    if Bridge.Framework() ~= 'rsg' then return nil end
    if not cores.rsg and GetResourceState('rsg-core') == 'started' then cores.rsg = exports['rsg-core']:GetCoreObject() end
    return cores.rsg
end

local function VORP()
    if Bridge.Framework() ~= 'vorp' then return nil end
    if not cores.vorp and GetResourceState('vorp_core') == 'started' then cores.vorp = exports.vorp_core:GetCore() end
    return cores.vorp
end

Bridge.RSG, Bridge.VORP = RSG, VORP

-- "First Last" (the player name when the character has none)
local function FullName(src, first, last)
    local name = ('%s %s'):format(first or '', last or ''):gsub('^%s+', ''):gsub('%s+$', '')
    return name ~= '' and name or GetPlayerName(src)
end

-- VORP user and active character
local function VorpUser(src)
    local core = VORP()
    local user = core and core.getUser(src)
    return user, user and user.getUsedCharacter
end

---------------------------------------------------------------------------
-- Ready: the framework / inventory may start after the script. Waits up to 60 s, prints what was
-- found and runs the Bridge.OnReady callbacks (e.g. registering usable items).
---------------------------------------------------------------------------
Bridge.ready = false
local readyCbs = {}

function Bridge.OnReady(cb)
    if Bridge.ready then CreateThread(cb) else readyCbs[#readyCbs + 1] = cb end
end

CreateThread(function()
    local t = GetGameTimer() + 60000
    while GetGameTimer() < t do
        local inv = Bridge.Inventory()
        if (RSG() or VORP()) and inv and GetResourceState(inv) == 'started' then break end
        Wait(500)
    end
    local res = Bridge.resource
    if not Bridge.Framework() then print(('^1[%s] No framework found (vorp_core / rsg-core). Set Config.Framework.^0'):format(res)) end
    if not Bridge.Inventory() then print(('^1[%s] No inventory found. Set Config.Inventory.^0'):format(res)) end
    print(('[%s] framework: ^2%s^0 | inventory: ^2%s^0'):format(res, tostring(Bridge.Framework()), tostring(Bridge.Inventory())))
    Bridge.ready = true
    for _, cb in ipairs(readyCbs) do CreateThread(cb) end
    readyCbs = {}
end)

---------------------------------------------------------------------------
-- Players
---------------------------------------------------------------------------

-- Returns a "player" with the same shape in both frameworks (nil = no character loaded):
-- { cid, name, firstname, lastname, job, jobLabel, grade, group,
--   money(type), remove(type, n, reason), add(type, n, reason), hasGroup(g) }
-- money type: 'cash' | 'gold' (on RSG gold is Config.RSGGoldAccount; nil = no gold)
function Bridge.GetPlayer(src)
    local rsg, vorp = RSG(), VORP()
    if rsg then
        local P = rsg.Functions.GetPlayer(src)
        if not P then return nil end
        local pd = P.PlayerData
        local ci, job = pd.charinfo or {}, pd.job or {}
        local function acc(t) if t == 'gold' then return Bridge.Setting('RSGGoldAccount') end return 'cash' end
        return {
            cid = pd.citizenid,
            name = FullName(src, ci.firstname, ci.lastname),
            firstname = ci.firstname, lastname = ci.lastname,
            job = job.name, jobLabel = job.label, grade = job.grade and job.grade.level or 0,
            group = nil,
            money = function(t) local a = acc(t) return a and tonumber(pd.money and pd.money[a]) or 0 end,
            remove = function(t, n, reason) local a = acc(t) return a ~= nil and P.Functions.RemoveMoney(a, n, reason) ~= false end,
            add = function(t, n, reason) local a = acc(t) if a then P.Functions.AddMoney(a, n, reason) end return a ~= nil end,
            hasGroup = function(g) return rsg.Functions.HasPermission(src, g) == true end,
        }
    elseif vorp then
        local user, char = VorpUser(src)
        if not char then return nil end
        local cur = { cash = 0, gold = 1 }
        local function bal(t) return tonumber(t == 'gold' and char.gold or char.money) or 0 end
        return {
            cid = tostring(char.charIdentifier),
            name = FullName(src, char.firstname, char.lastname),
            firstname = char.firstname, lastname = char.lastname,
            job = char.job, jobLabel = char.jobLabel or char.job, grade = tonumber(char.jobGrade) or 0,
            group = user.getGroup,
            money = bal,
            -- vorp removes even without enough money: checked here (with a margin for float rounding)
            remove = function(t, n) if bal(t) + 0.0001 < n then return false end char.removeCurrency(cur[t] or 0, n) return true end,
            add = function(t, n) char.addCurrency(cur[t] or 0, n) return true end,
            hasGroup = function(g) return user.getGroup == g or char.group == g end,
        }
    end
end

function Bridge.HasCharacter(src)
    return Bridge.GetPlayer(src) ~= nil
end

-- character name (falls back to the player name)
function Bridge.CharacterName(src)
    local P = Bridge.GetPlayer(src)
    return P and P.name or GetPlayerName(src)
end

-- players with a character: { { id, name, steam }, ... }
function Bridge.Players()
    local list = {}
    for _, id in ipairs(GetPlayers()) do
        local src = tonumber(id)
        local P = Bridge.GetPlayer(src)
        if P then list[#list + 1] = { id = src, name = P.name, steam = GetPlayerName(src) } end
    end
    table.sort(list, function(a, b) return a.id < b.id end)
    return list
end

-- cb(src) when a player loads a character
function Bridge.OnCharacterLoaded(cb)
    AddEventHandler('vorp:SelectedCharacter', function(src) cb(src) end)
    RegisterNetEvent('RSGCore:Server:OnPlayerLoaded', function() cb(source) end)
end

---------------------------------------------------------------------------
-- Permissions
---------------------------------------------------------------------------

-- admin? groups = VORP groups / RSG permissions (default Config.AdminGroups or admin, superadmin)
-- ace = extra ACE that is also allowed. The server console (0) and full ACE access ('command') always are.
function Bridge.IsAdmin(src, groups, ace)
    if src == 0 then return true end
    if ace and IsPlayerAceAllowed(src, ace) then return true end
    groups = groups or Bridge.Setting('AdminGroups', { 'admin', 'superadmin' })
    local rsg, vorp = RSG(), VORP()
    if vorp then
        local user, char = VorpUser(src)
        for _, g in ipairs(groups) do
            if (user and user.getGroup == g) or (char and char.group == g) then return true end
        end
    elseif rsg then
        for _, g in ipairs(groups) do
            if rsg.Functions.HasPermission(src, g) then return true end
        end
        if rsg.Functions.HasPermission(src, 'god') then return true end
    end
    return IsPlayerAceAllowed(src, 'command')
end

-- admin command: args = { { name = '', help = '' }, ... } (chat suggestions) · cb(src, args)
function Bridge.RegisterAdminCommand(name, help, args, cb, groups)
    RegisterCommand(name, function(src, cmdArgs)
        if Bridge.IsAdmin(src, groups) then cb(src, cmdArgs) end
    end, false)
    TriggerClientEvent('chat:addSuggestion', -1, '/' .. name, help, args or {})
end

---------------------------------------------------------------------------
-- Notifications (fks-utils panel)
--   Bridge.Notify(src, 'Message', 'success', 5000, 'Title') | Bridge.Notify(src, { title, description, type, duration })
---------------------------------------------------------------------------
function Bridge.Notify(src, ...)
    TriggerClientEvent('fks-utils:client:notify', src, ...)
end

---------------------------------------------------------------------------
-- Items
---------------------------------------------------------------------------
local function RsgItemBox(src, item, kind, n)
    local rsg = RSG()
    local data = rsg and rsg.Shared and rsg.Shared.Items and rsg.Shared.Items[item]
    if data then TriggerClientEvent('rsg-inventory:client:ItemBox', src, data, kind, n) end
end

-- usable items: cb(src, item)
local oxUsable = {}
function Bridge.RegisterUsable(item, cb)
    local INV, rsg = Bridge.Inventory(), RSG()
    if INV == 'vorp_inventory' then
        exports.vorp_inventory:registerUsableItem(item, function(data)
            pcall(function() exports.vorp_inventory:closeInventory(data.source) end)
            cb(data.source, item)
        end, Bridge.resource)
    elseif rsg then
        -- rsg-inventory and ox_inventory (rsg bridge) use rsg-core usable items
        rsg.Functions.CreateUseableItem(item, function(src) cb(src, item) end)
    elseif INV == 'ox_inventory' then
        oxUsable[item] = cb
    end
end

-- ox_inventory without rsg-core (e.g. vorp + ox): catches the use by event
AddEventHandler('ox_inventory:usedItem', function(src, name)
    if RSG() then return end
    local cb = oxUsable[name]
    if cb then cb(src, name) end
end)

-- item data from the inventory (nil = unknown item)
local function ItemData(item)
    local INV = Bridge.Inventory()
    local ok, data = pcall(function()
        if INV == 'ox_inventory' then return exports.ox_inventory:Items(item) end
        if INV == 'vorp_inventory' then return exports.vorp_inventory:getItemDB(item) end
        local rsg = RSG()
        return rsg and rsg.Shared.Items[item]
    end)
    return ok and data or nil
end

function Bridge.ItemExists(item)
    return ItemData(item) ~= nil
end

function Bridge.ItemLabel(item)
    local data = ItemData(item)
    return data and data.label or item
end

function Bridge.ItemCount(src, item)
    local INV = Bridge.Inventory()
    if INV == 'ox_inventory' then
        return exports.ox_inventory:GetItemCount(src, item) or 0
    elseif INV == 'rsg-inventory' then
        local ok, n = pcall(function() return exports['rsg-inventory']:GetItemCount(src, item) end)
        if ok and n then return tonumber(n) or 0 end
        -- fallback (older rsg-inventory): read it from the rsg-core player
        local rsg = RSG()
        local P = rsg and rsg.Functions.GetPlayer(src)
        local it = P and P.Functions.GetItemByName(item)
        return it and (it.amount or it.count or 0) or 0
    elseif INV == 'vorp_inventory' then
        return tonumber(exports.vorp_inventory:getItemCount(src, nil, item)) or 0
    end
    return 0
end

function Bridge.HasItem(src, item, n)
    return Bridge.ItemCount(src, item) >= (n or 1)
end

function Bridge.CanCarry(src, item, n)
    local INV = Bridge.Inventory()
    local ok, res = pcall(function()
        if INV == 'ox_inventory' then return exports.ox_inventory:CanCarryItem(src, item, n or 1) end
        if INV == 'rsg-inventory' then return exports['rsg-inventory']:CanAddItem(src, item, n or 1) end
        if INV == 'vorp_inventory' then return exports.vorp_inventory:canCarryItem(src, item, n or 1) end
    end)
    if not ok or res == nil then return true end -- export missing: let AddItem decide
    return res and true or false
end

-- metadata: ox metadata / rsg info / vorp metadata (optional)
function Bridge.AddItem(src, item, n, metadata)
    n = n or 1
    local INV = Bridge.Inventory()
    if INV == 'ox_inventory' then
        return exports.ox_inventory:AddItem(src, item, n, metadata) and true or false
    elseif INV == 'rsg-inventory' then
        local ok = exports['rsg-inventory']:AddItem(src, item, n, false, metadata or false, Bridge.resource) and true or false
        if ok then RsgItemBox(src, item, 'add', n) end
        return ok
    elseif INV == 'vorp_inventory' then
        return exports.vorp_inventory:addItem(src, item, n, metadata) ~= false
    end
    return false
end

function Bridge.RemoveItem(src, item, n)
    n = n or 1
    local INV = Bridge.Inventory()
    if INV == 'ox_inventory' then
        return exports.ox_inventory:RemoveItem(src, item, n) and true or false
    elseif INV == 'rsg-inventory' then
        local ok = exports['rsg-inventory']:RemoveItem(src, item, n, nil, Bridge.resource) and true or false
        if ok then RsgItemBox(src, item, 'remove', n) end
        return ok
    elseif INV == 'vorp_inventory' then
        if Bridge.ItemCount(src, item) < n then return false end
        return exports.vorp_inventory:subItem(src, item, n) ~= false
    end
    return false
end

---------------------------------------------------------------------------
-- Storages
---------------------------------------------------------------------------

-- opens a storage. slots = visible slots (ox / rsg grid) · weight = max weight
-- capacity = total amount of items (vorp has no grid nor weight: uses this, or slots)
function Bridge.OpenStash(src, id, label, slots, weight, capacity)
    local INV = Bridge.Inventory()
    if INV == 'ox_inventory' then
        exports.ox_inventory:RegisterStash(id, label, slots, weight)
        exports.ox_inventory:forceOpenInventory(src, 'stash', id)
    elseif INV == 'rsg-inventory' then
        exports['rsg-inventory']:OpenInventory(src, id, { label = label, maxweight = weight, slots = slots })
    elseif INV == 'vorp_inventory' then
        local limit = capacity or slots
        if exports.vorp_inventory:isCustomInventoryRegistered(id) then
            -- already registered (maybe with another limit, e.g. after changing the config)
            pcall(function() exports.vorp_inventory:updateCustomInventorySlots(id, limit) end)
        else
            exports.vorp_inventory:registerInventory({
                id = id, name = label, limit = limit,
                acceptWeapons = true, shared = true, ignoreItemStackLimit = true,
                whitelistItems = false, UsePermissions = false, UseBlackList = false, whitelistWeapons = false,
            })
        end
        exports.vorp_inventory:openInventory(src, id)
    end
end

-- deletes a storage and its contents
function Bridge.DeleteStash(id)
    local INV = Bridge.Inventory()
    if INV == 'ox_inventory' then
        exports.oxmysql:update('DELETE FROM ox_inventory WHERE name = ?', { id })
    elseif INV == 'rsg-inventory' then
        pcall(function() exports['rsg-inventory']:DeleteInventory(id) end)
        pcall(function() exports.oxmysql:update('DELETE FROM inventories WHERE identifier = ?', { id }) end)
    elseif INV == 'vorp_inventory' then
        pcall(function() exports.vorp_inventory:removeInventory(id) end)
        exports.oxmysql:update('DELETE FROM character_inventories WHERE inventory_type = ?', { id })
    end
end

---------------------------------------------------------------------------
-- Version check: compares the version in the script's fxmanifest.lua with the one on GitHub
-- (raw fxmanifest.lua of the branch, so a push is enough - no release needed) and prints
-- "up to date" / "OUTDATED" in the server console.
--   Bridge.CheckVersion('Fonkas/fks-stables', { branch = 'main', interval = 12 })
---------------------------------------------------------------------------
function Bridge.CheckVersion(repo, opts)
    if not repo or repo == '' then return end
    opts = opts or {}
    local res = Bridge.resource

    local function check()
        local current = GetResourceMetadata(res, 'version', 0) or '0.0.0'
        local url = ('https://raw.githubusercontent.com/%s/%s/fxmanifest.lua'):format(repo, opts.branch or 'main')
        PerformHttpRequest(url, function(status, body)
            local latest = status == 200 and body and body:match("\nversion%s+['\"]([^'\"]+)['\"]")
            if not latest then
                print(('^3[%s] could not check for updates (HTTP %s)^0'):format(res, tostring(status)))
                return
            end
            if Bridge.IsNewer(latest, current) then
                print('^1================================================================^0')
                print(('^1[%s] OUTDATED^0  installed: ^3%s^0  ->  latest: ^2%s^0'):format(res, current, latest))
                print(('^1[%s]^0 download: https://github.com/%s'):format(res, repo))
                print('^1================================================================^0')
            else
                print(('^2[%s] up to date (v%s)^0'):format(res, current))
            end
        end, 'GET', '', { ['User-Agent'] = res })
    end

    CreateThread(function()
        Wait(5000) -- let the server finish starting
        check()
        local hours = tonumber(opts.interval) or 0
        while hours > 0 do
            Wait(hours * 3600000)
            check()
        end
    end)
end
