---------------------------------------------------------------------------
-- NUI bridge: messages sent before the page is ready are queued
---------------------------------------------------------------------------
local uiReady = false
local queue = {}

function SendUI(action, data)
    if not uiReady then
        queue[#queue + 1] = { action = action, data = data }
        return
    end
    SendNUIMessage({ action = action, data = data })
end

RegisterNUICallback('ready', function(_, cb)
    uiReady = true
    SendNUIMessage({
        action = 'init',
        data = {
            locale = LocaleUI,
            notify = Config.Notify,
            progress = { position = Config.Progress.position, cancelKey = Config.Progress.cancelKeyLabel },
        },
    })
    for _, msg in ipairs(queue) do SendNUIMessage(msg) end
    queue = {}
    cb('ok')
end)
