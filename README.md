# fks-utils

Shared base of the FKS scripts (RedM · VORP / RSG): one framework bridge for every script, notifications,
progress bar and an admin item panel.

## Installation

```cfg
ensure ox_lib
ensure oxmysql
ensure vorp_core        # or rsg-core
ensure vorp_inventory   # or rsg-inventory / ox_inventory
ensure fks-utils        # before the FKS scripts
ensure fks-stables
```

The server console shows whether fks-utils is **up to date** or **OUTDATED** compared with GitHub (`Config.VersionCheck`).

## Bridge (for script developers)

One line in the script's `fxmanifest.lua` gives it the `Bridge` table on the server and the client, for VORP and RSG with
`vorp_inventory`, `rsg-inventory` or `ox_inventory`. The code runs inside the script, so callbacks and returned tables work
like local code — and a fix in fks-utils reaches every script.

```lua
shared_scripts {
    '@ox_lib/init.lua',
    '@fks-utils/import.lua',
    'config.lua',
}
fks_utils_version '1.1.0' -- optional: warns in the console when the installed fks-utils is older
```

Optional settings, read from the script's own `Config` (all have defaults):

| Setting | Default | |
|---|---|---|
| `Config.Framework` | `'auto'` | `'vorp'` / `'rsg'` |
| `Config.Inventory` | `'auto'` | `'ox_inventory'` / `'rsg-inventory'` / `'vorp_inventory'` (auto: in this order) |
| `Config.RSGGoldAccount` | `nil` | rsg-core money account used as `'gold'` (`nil` = no gold on RSG) |
| `Config.AdminGroups` | `{ 'admin', 'superadmin' }` | VORP groups / RSG permissions for `Bridge.IsAdmin` |

### Server

```lua
Bridge.OnReady(function() ... end)              -- framework and inventory found (they may start after the script)
Bridge.Framework()  Bridge.Inventory()          -- 'vorp' | 'rsg' · 'ox_inventory' | 'rsg-inventory' | 'vorp_inventory'

local P = Bridge.GetPlayer(src)                 -- nil = no character loaded
-- P.cid, P.name, P.firstname, P.lastname, P.job, P.jobLabel, P.grade, P.group
-- P.money('cash' | 'gold'), P.remove(type, n, reason) -> bool, P.add(type, n, reason), P.hasGroup(g)
Bridge.HasCharacter(src)  Bridge.CharacterName(src)  Bridge.Players()
Bridge.OnCharacterLoaded(function(src) end)

Bridge.IsAdmin(src, groups?, ace?)              -- console and full ACE ('command') always allowed
Bridge.RegisterAdminCommand(name, help, args, function(src, args) end, groups?)
Bridge.Notify(src, 'Message', 'success')        -- fks-utils notification (src = -1: everyone)

Bridge.RegisterUsable(item, function(src, item) end)
Bridge.ItemCount(src, item)  Bridge.HasItem(src, item, n)  Bridge.CanCarry(src, item, n)
Bridge.AddItem(src, item, n, metadata?)  Bridge.RemoveItem(src, item, n)
Bridge.ItemExists(item)  Bridge.ItemLabel(item)
Bridge.OpenStash(src, id, label, slots, weight, capacity?)  Bridge.DeleteStash(id)

Bridge.CheckVersion('Fonkas/my-script', { branch = 'main', interval = 12 }) -- "up to date" / "OUTDATED" in the console
```

### Client

```lua
Bridge.IsLoggedIn()
Bridge.OnLoaded(function() end)                 -- also runs on resource restart with the character loaded
Bridge.OnUnloaded(function() end)
Bridge.GetJob()                                 -- { name, label, grade }
Bridge.OnJobUpdate(function() end)
Bridge.Notify('Message', 'success')             -- fks-utils notification
Bridge.Progress({ duration = 5000, label = '...' })
```

> When fks-utils is missing, `@fks-utils/import.lua` prints the download link in the console. List it in the script's
> `dependencies` only if you prefer the server to refuse to start the script instead.

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
