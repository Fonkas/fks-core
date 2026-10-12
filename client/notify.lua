---------------------------------------------------------------------------
-- Notifications
--   exports['fks-utils']:Notify('Message', 'success', 5000, 'Title')
--   exports['fks-utils']:Notify({ title = 'Title', description = 'Message', type = 'error', duration = 5000 })
-- type: 'inform' | 'success' | 'error' | 'warning' (ox_lib / RSG names are accepted too)
---------------------------------------------------------------------------
local KINDS = {
    inform = 'inform', info = 'inform', primary = 'inform',
    success = 'success',
    error = 'error',
    warning = 'warning', warn = 'warning',
}

local function Normalize(a, kind, duration, title)
    local d = type(a) == 'table' and a or { description = a, type = kind, duration = duration, title = title }
    local text = d.description or d.message or d.text
    if not text and not d.title then return end
    return {
        title = d.title or Config.Notify.title,
        description = text and tostring(text) or '',
        type = KINDS[d.type or 'inform'] or 'inform',
        duration = tonumber(d.duration) or Config.Notify.duration,
    }
end

function Notify(...)
    local data = Normalize(...)
    if not data then return end
    if Config.Notify.sound then PlaySoundFrontend('INFO_SHOW', 'Ledger_Sounds', true, 0) end
    SendUI('notify', data)
end

exports('Notify', Notify)

RegisterNetEvent('fks-utils:client:notify', function(...)
    Notify(...)
end)
