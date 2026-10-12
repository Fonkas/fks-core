---------------------------------------------------------------------------
-- Notifications from the server (same arguments as the client export, plus the player)
--   exports['fks-utils']:Notify(source, 'Message', 'success', 5000, 'Title')
--   exports['fks-utils']:Notify(source, { title = 'Title', description = 'Message', type = 'error' })
--   source = -1 notifies everyone
---------------------------------------------------------------------------
function Notify(src, ...)
    TriggerClientEvent('fks-utils:client:notify', src, ...)
end

exports('Notify', Notify)
