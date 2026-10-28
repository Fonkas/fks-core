fx_version 'cerulean'
game 'rdr3'
rdr3_warning 'I acknowledge that this is a prerelease build of RedM, and I am aware my resources *will* become incompatible once RedM ships.'
lua54 'yes'

name 'fks-core'
author 'FKS'
description 'Shared base of the FKS scripts: VORP / RSG bridge, shared UI, notifications, progress bar, admin item panel'
version '2.1.2'
license 'GPL-3.0-or-later'

shared_scripts {
    'config.lua',
    'locales/*.lua',
    'shared/locale.lua',
    'bridge/shared.lua',
}

client_scripts {
    'client/main.lua',
    'client/notify.lua',
    'client/progress.lua',
    'client/items.lua',
    'client/ui.lua',
}

server_scripts {
    '@oxmysql/lib/MySQL.lua',
    'bridge/server.lua',
    'server/items_bridge.lua',
    'server/notify.lua',
    'server/items.lua',
    'server/version.lua',
}

ui_page 'html/index.html'

files {
    'import.lua',       -- the bridge other scripts import: shared_script '@fks-core/import.lua'
    'bridge/*.lua',
    'html/index.html',
    'html/theme.css',   -- FKS design system (tokens, fonts, shared pieces)
    'html/style.css',
    'html/app.js',
    'html/ui/*',        -- shared UI runtime + components (docs/UI-API.md)
    'html/fonts/*.woff2',
    'html/img/*',
    'html/pannel.png',
    'html/logo.*',      -- the server logo: html/logo.png (or .jpg / .webp / .svg)
}

-- + a framework (vorp_core or rsg-core) and an inventory (vorp_inventory, rsg-inventory or ox_inventory)
dependencies {
    'oxmysql',
}
