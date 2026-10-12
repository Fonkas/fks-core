---------------------------------------------------------------------------
-- Admin item panel (/items)
---------------------------------------------------------------------------
if not Config.Items.enabled then return end

local catalogue, byKey = nil, {}
local sentTo = {} -- [src] = true once the catalogue was sent (it is cached in the page)

local function Key(kind, name) return kind .. ':' .. name end

local function Catalogue()
    if catalogue and #catalogue > 0 then return catalogue end
    catalogue, byKey = Bridge.Catalogue(), {}
    for _, e in ipairs(catalogue) do byKey[Key(e.kind, e.name)] = e end
    return catalogue
end

RegisterCommand(Config.Items.command, function(src)
    if src == 0 then return print('[fks-utils] /' .. Config.Items.command .. ' can only be used in game.') end
    if not Bridge.IsAdmin(src) then return Notify(src, _L('no_permission'), 'error') end

    local list = Catalogue()
    TriggerLatentClientEvent('fks-utils:client:openItems', src, 200000, {
        items = not sentTo[src] and list or nil,
        players = Bridge.Players(),
        me = src,
        maxAmount = Config.Items.maxAmount,
        maxWeapons = Config.Items.maxWeapons,
    })
    sentTo[src] = true
end, false)

AddEventHandler('playerDropped', function() sentTo[source] = nil end)

RegisterNetEvent('fks-utils:server:give', function(name, kind, target, amount)
    local src = source
    if not Bridge.IsAdmin(src) then return end

    local entry = type(name) == 'string' and type(kind) == 'string' and byKey[Key(kind, name)]
    if not entry then return Notify(src, _L('invalid_item'), 'error') end

    amount = math.floor(tonumber(amount) or 0)
    local max = entry.kind == 'weapon' and (Config.Items.maxWeapons or 10) or (Config.Items.maxAmount or 1000)
    if amount < 1 or amount > max then return Notify(src, _L('invalid_amount'), 'error') end

    target = target == 'self' and src or tonumber(target)
    if not target or not GetPlayerName(target) or not Bridge.HasCharacter(target) then
        return Notify(src, _L('player_offline'), 'error')
    end

    local targetName = Bridge.CharacterName(target) or GetPlayerName(target)
    local ok, err = Bridge.Give(target, entry, amount)
    if not ok then
        return Notify(src, err == 'cant_carry' and _L('cant_carry', targetName) or _L('give_failed', entry.label), 'error')
    end

    if target == src then
        Notify(src, _L('gave_self', amount, entry.label), 'success')
    else
        Notify(src, _L('gave', amount, entry.label, targetName), 'success')
        Notify(target, _L('received', amount, entry.label), 'success')
    end

    if Config.Items.logGives then
        print(('[fks-utils] %s [%s] gave %sx %s (%s) to %s [%s]'):format(
            GetPlayerName(src), src, amount, entry.name, entry.kind, GetPlayerName(target), target))
    end
end)
