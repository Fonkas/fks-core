---------------------------------------------------------------------------
-- Progress bar (blocks until it ends, returns true if it reached the end)
--   local done = exports['fks-utils']:Progress({
--       duration = 5000, label = 'Bandaging...',
--       canCancel = true, useWhileDead = false,
--       disable = { move = true, mount = true, combat = true, sprint = true, mouse = false },
--       anim = { dict = 'mech_inventory@crafting@fallbacks', clip = 'full_craft_and_stow', flag = 17 } -- or { scenario = 'WORLD_HUMAN_CROUCH_INSPECT' },
--       prop = { model = 'p_bottlebeer01x', bone = 'SKEL_R_HAND', pos = vec3(0, 0, 0), rot = vec3(0, 0, 0) },
--   })
--   exports['fks-utils']:ProgressActive()  -> true while a bar is running
--   exports['fks-utils']:CancelProgress()  -> cancels the running bar (it returns false)
---------------------------------------------------------------------------
local active = nil

local CONTROLS = {
    move   = { 0x4D8FB4C1, 0xFDA83190, 0xD9D0E1C0 },             -- move left/right, forward/back, jump
    sprint = { 0x8FFC75D6 },
    combat = { 0x07CE1E61, 0xF84FA74F, 0xB2F377E8, 0xAC4BD4F1 }, -- attack, aim, melee, weapon wheel
    mouse  = { 0xA987235F, 0xD2047988 },                         -- look around
    mount  = { 0xCEFD9220 },                                     -- mount / enter
}

local function DisableControls(disable)
    for key, on in pairs(disable) do
        if on and CONTROLS[key] then
            for _, hash in ipairs(CONTROLS[key]) do DisableControlAction(0, hash, true) end
        end
    end
end

local function LoadModel(model)
    local hash = type(model) == 'string' and joaat(model) or model
    if not IsModelValid(hash) then return end
    RequestModel(hash)
    local t = GetGameTimer() + 3000
    while not HasModelLoaded(hash) and GetGameTimer() < t do Wait(10) end
    return HasModelLoaded(hash) and hash or nil
end

local function PlayAnim(ped, anim)
    if anim.scenario then
        TaskStartScenarioInPlace(ped, joaat(anim.scenario), -1, true, false, false, false)
        return true
    end
    if not (anim.dict and anim.clip) then return false end
    RequestAnimDict(anim.dict)
    local t = GetGameTimer() + 3000
    while not HasAnimDictLoaded(anim.dict) and GetGameTimer() < t do Wait(10) end
    if not HasAnimDictLoaded(anim.dict) then return false end
    TaskPlayAnim(ped, anim.dict, anim.clip, anim.blendIn or 3.0, anim.blendOut or 3.0, -1, anim.flag or 49, 0, false, false, false)
    return true
end

local function AttachProp(ped, prop)
    local hash = LoadModel(prop.model)
    if not hash then return end
    local c = GetEntityCoords(ped)
    local obj = CreateObject(hash, c.x, c.y, c.z + 0.2, true, true, false, false, true)
    local bone = type(prop.bone) == 'string' and GetEntityBoneIndexByName(ped, prop.bone) or prop.bone or GetEntityBoneIndexByName(ped, 'SKEL_R_HAND')
    local p, r = prop.pos or vector3(0, 0, 0), prop.rot or vector3(0, 0, 0)
    AttachEntityToEntity(obj, ped, bone, p.x, p.y, p.z, r.x, r.y, r.z, false, false, false, true, 2, true, false, false)
    SetModelAsNoLongerNeeded(hash)
    return obj
end

function Progress(data)
    data = type(data) == 'table' and data or {}
    if active then return false end

    local ped = PlayerPedId()
    if not data.useWhileDead and IsEntityDead(ped) then return false end

    local job = { cancelled = false }
    active = job

    local duration = math.max(tonumber(data.duration) or 3000, 0)
    local disable = data.disable or {}
    local animated = data.anim and PlayAnim(ped, data.anim)
    local prop = data.prop and AttachProp(ped, data.prop)

    SendUI('progress', { label = data.label or '', duration = duration, canCancel = data.canCancel == true })

    local p = promise.new()
    CreateThread(function()
        local t0 = GetGameTimer()
        while GetGameTimer() - t0 < duration do
            ped = PlayerPedId()
            if not data.useWhileDead and IsEntityDead(ped) then job.cancelled = true end
            if data.canCancel and (IsControlJustPressed(0, Config.Progress.cancelKey) or IsDisabledControlJustPressed(0, Config.Progress.cancelKey)) then
                job.cancelled = true
            end
            if job.cancelled then break end
            DisableControls(disable)
            Wait(0)
        end

        if animated then
            if data.anim.scenario then ClearPedTasks(ped) else StopAnimTask(ped, data.anim.dict, data.anim.clip, 1.0) end
        end
        if prop and DoesEntityExist(prop) then DeleteObject(prop) end

        SendUI('progressEnd', { cancelled = job.cancelled })
        active = nil
        p:resolve(not job.cancelled)
    end)

    return Citizen.Await(p)
end

function ProgressActive()
    return active ~= nil
end

function CancelProgress()
    if active then active.cancelled = true end
end

exports('Progress', Progress)
exports('ProgressActive', ProgressActive)
exports('CancelProgress', CancelProgress)
