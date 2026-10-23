Config = {}

-- Server console: "up to date" / "OUTDATED" compared with the version on GitHub
Config.VersionCheck = {
    enabled  = true,
    repo     = 'Fonkas/fks-core',   -- GitHub "user/repository"
    branch   = 'main',
    interval = 12,                   -- check again every X hours (0 = only on start)
}

-- 'auto' (detects rsg-core / vorp_core) | 'vorp' | 'rsg'
Config.Framework = 'auto'
-- 'auto' (ox_inventory > rsg-inventory > vorp_inventory) | 'vorp' | 'rsg' | 'ox'
Config.Inventory = 'auto'

-- Language: 'pt' | 'en' (files in locales/; missing keys fall back to English)
Config.Locale = 'pt'

---------------------------------------------------------------------------
-- Theme: the look of every FKS script UI (they are all drawn by fks-core)
---------------------------------------------------------------------------
Config.Theme = {
    scale = 1.0,            -- size of everything (1.0 = default, 1.2 = 20% bigger)
    position = 'left',      -- side of the screen for script panels: 'left' | 'right'

    -- colors (nil / removed = default). Any CSS color: '#f2c14e', 'rgb(242, 193, 78)'...
    colors = {
        -- paper   = '#e8dcc4',  -- main text
        -- paper2  = '#cfc2a6',  -- secondary text
        -- muted   = '#a39a88',  -- labels, hints
        -- gold    = '#f2c14e',  -- highlights, selected, main buttons
        -- gold2   = '#c9962a',  -- darker gold (gradients)
        -- danger  = '#d9553f',  -- errors, delete / sell
        -- good    = '#9cc27a',  -- success
        -- line    = 'rgba(232, 220, 196, .22)',  -- borders
    },
}

---------------------------------------------------------------------------
-- Notifications
-- The panel is html/pannel.png and the logo on its left is html/logo.png
-- (just replace that file with your server logo - .png, .jpg, .webp or .svg).
---------------------------------------------------------------------------
Config.Notify = {
    -- 'top-right' | 'top-left' | 'top-center' | 'bottom-right' | 'bottom-left' | 'bottom-center' | 'center-right' | 'center-left'
    position = 'center-left',
    duration = 5000,        -- default time on screen (ms)
    max = 5,                -- notifications visible at the same time
    sound = true,           -- frontend sound when one appears
    title = 'FKScripts',    -- title used when the script does not send one
}

---------------------------------------------------------------------------
-- Progress bar
---------------------------------------------------------------------------
Config.Progress = {
    position = 'bottom',    -- 'bottom' | 'center'
    cancelKey = 0x8CC9CD42, -- X
    cancelKeyLabel = 'X',
}

---------------------------------------------------------------------------
-- Admin item panel (/items)
---------------------------------------------------------------------------
Config.Items = {
    enabled = true,
    command = 'items',
    maxAmount = 10000,                       -- most you can give in one go
    maxWeapons = 10,                        -- weapons are created one by one, so keep this low
    vorpGroups = { 'admin', 'superadmin' }, -- VORP: user groups allowed
    rsgPermission = 'admin',                -- RSG: permission allowed (admin / god)
    ace = 'fks-core.items',                 -- anyone with this ACE can also use it (add_ace group.admin fks-core.items allow)
    logGives = true,                        -- print every give to the server console

    -- where the item images live (nui:// path, {name} / {image} are replaced). nil = default of the inventory.
    imagePath = nil,
}
