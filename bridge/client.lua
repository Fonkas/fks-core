---------------------------------------------------------------------------
-- Bridge (client): character loaded / unloaded, job, notifications and progress bar for VORP / RSG
---------------------------------------------------------------------------
Bridge = Bridge or {}

local rsgCore
local function RSG()
    if Bridge.Framework() ~= 'rsg' then return nil end
    if not rsgCore and GetResourceState('rsg-core') == 'started' then rsgCore = exports['rsg-core']:GetCoreObject() end
    return rsgCore
end
Bridge.RSG = RSG

-- is the character loaded / in session?
function Bridge.IsLoggedIn()
    local fw = Bridge.Framework()
    if fw == 'rsg' then return LocalPlayer.state.isLoggedIn == true end
    if fw == 'vorp' then return LocalPlayer.state.IsInSession == true end
    return false
end

---------------------------------------------------------------------------
-- Character loaded / unloaded: cb() runs in its own thread.
-- Also runs on resource (re)start when the character is already loaded.
---------------------------------------------------------------------------
local loadedCbs, unloadedCbs = {}, {}
function Bridge.OnLoaded(cb) loadedCbs[#loadedCbs + 1] = cb end
function Bridge.OnUnloaded(cb) unloadedCbs[#unloadedCbs + 1] = cb end

local function fire(list)
    for _, cb in ipairs(list) do CreateThread(cb) end
end

RegisterNetEvent('RSGCore:Client:OnPlayerLoaded', function() fire(loadedCbs) end)
RegisterNetEvent('vorp:SelectedCharacter', function() fire(loadedCbs) end)
RegisterNetEvent('RSGCore:Client:OnPlayerUnload', function() fire(unloadedCbs) end)

AddEventHandler('onClientResourceStart', function(res)
    if res ~= Bridge.resource then return end
    CreateThread(function()
        Wait(1000)
        if Bridge.IsLoggedIn() then fire(loadedCbs) end
    end)
end)

---------------------------------------------------------------------------
-- Job
---------------------------------------------------------------------------
-- { name, label, grade } of the current character
function Bridge.GetJob()
    local fw = Bridge.Framework()
    if fw == 'rsg' then
        local rsg = RSG()
        local job = rsg and (rsg.Functions.GetPlayerData() or {}).job or {}
        return { name = job.name, label = job.label or job.name, grade = job.grade and job.grade.level or 0 }
    elseif fw == 'vorp' then
        local ch = LocalPlayer.state.Character or {}
        return { name = ch.Job, label = ch.JobLabel or ch.Job, grade = tonumber(ch.Grade) or 0 }
    end
    return {}
end

-- cb() when the job changes (runs a moment later, after the framework updates the data)
local jobCbs = {}
function Bridge.OnJobUpdate(cb) jobCbs[#jobCbs + 1] = cb end
local function jobChanged() SetTimeout(1000, function() fire(jobCbs) end) end
RegisterNetEvent('RSGCore:Client:OnJobUpdate', jobChanged)
RegisterNetEvent('vorp:setjob', jobChanged)

---------------------------------------------------------------------------
-- Notifications and progress bar (fks-core panels)
--   Bridge.Notify('Message', 'success', 5000, 'Title') | Bridge.Notify({ title, description, type, duration })
--   Bridge.Progress({ duration, label, canCancel, anim, prop, disable... }) -> true finished / false cancelled
---------------------------------------------------------------------------
function Bridge.Notify(...)
    return exports['fks-core']:Notify(...)
end

function Bridge.Progress(data)
    return exports['fks-core']:Progress(data)
end

function Bridge.ProgressActive()
    return exports['fks-core']:ProgressActive()
end

function Bridge.CancelProgress()
    return exports['fks-core']:CancelProgress()
end
