# fks-utils

Shared dependency for the FKS scripts (VORP / RSG). It bundles utilities that we keep adding over time.

```lua
-- the script's fxmanifest.lua
dependencies { 'fks-utils' }
```

## Notifications

Panel `html/pannel.png` with the server logo on the left. To change the logo just replace
`html/logo.png` (`logo.webp`, `logo.jpg`, `logo.jpeg` or `logo.svg` also work). Without a logo the panel shows only the text.

```lua
-- client
exports['fks-utils']:Notify('Message', 'success', 5000, 'Title')
exports['fks-utils']:Notify({ title = 'Title', description = 'Message', type = 'error', duration = 5000 })

-- server (source = -1 sends to everyone)
exports['fks-utils']:Notify(source, 'Message', 'success')
TriggerClientEvent('fks-utils:client:notify', source, { title = 'Title', description = 'Message', type = 'warning' })
```

`type`: `inform` · `success` · `error` · `warning` (the ox_lib / RSG names also work: `info`, `primary`, `warn`).
Position, duration, max on screen and sound in `Config.Notify`.

## Progress bar

Blocks until it ends; returns `true` if it finished and `false` if it was cancelled (X key, death or `CancelProgress`).
Accepts the same table as ox_lib's `lib.progressBar`.

```lua
local done = exports['fks-utils']:Progress({
    duration = 5000,
    label = 'Bandaging the wound...',
    canCancel = true,
    useWhileDead = false,
    disable = { move = true, sprint = true, combat = true, mount = true, mouse = false },
    anim = { dict = 'mech_inventory@crafting@fallbacks', clip = 'full_craft_and_stow', flag = 17 }, -- or { scenario = 'WORLD_HUMAN_CROUCH_INSPECT' }
    prop = { model = 'p_bottlebeer01x', bone = 'SKEL_R_HAND', pos = vec3(0.0, 0.0, 0.0), rot = vec3(0.0, 0.0, 0.0) },
})

exports['fks-utils']:ProgressActive()  -- true while a bar is running
exports['fks-utils']:CancelProgress()  -- cancels the current bar
```

## /items (admin)

Panel with every item, weapon and ammo from the inventory (vorp_inventory, rsg-inventory or ox_inventory), with images,
search and category filter. Click an item → give it to yourself or to another player, with the amount.

Who can use it (`Config.Items`):
- VORP: groups in `vorpGroups` (default `admin`, `superadmin`)
- RSG: the `rsgPermission` permission (default `admin`, and `god`)
- anyone with the `fks-utils.items` ACE or the `command` ACE (`group.admin` in server.cfg already has it)

The server validates the permission, item, amount and player again on every give, and prints to the console who gave what to whom (`logGives`).

## License

GNU GPL v3 or later (see `LICENSE`).
