---------------------------------------------------------------------------
-- Admin item panel (/items) - the server checks permissions on open AND on every give
---------------------------------------------------------------------------
local open = false

RegisterNetEvent('fks-core:client:openItems', function(payload)
    open = true
    SetNuiFocus(true, true)
    SendUI('items:open', payload)
end)

local function Close()
    if not open then return end
    open = false
    SetNuiFocus(false, false)
end

RegisterNUICallback('items:close', function(_, cb)
    Close()
    cb('ok')
end)

RegisterNUICallback('items:give', function(data, cb)
    if open and type(data) == 'table' then
        TriggerServerEvent('fks-core:server:give', data.name, data.kind, data.target, data.amount)
    end
    cb('ok')
end)

AddEventHandler('onResourceStop', function(res)
    if res == GetCurrentResourceName() and open then SetNuiFocus(false, false) end
end)
