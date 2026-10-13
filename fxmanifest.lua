fx_version 'cerulean'
game 'rdr3'
rdr3_warning 'I acknowledge that this is a prerelease build of RedM, and I am aware my resources *will* become incompatible once RedM ships.'
lua54 'yes'

name 'fks-utils'
author 'FKS'
description 'Shared base of the FKS scripts: VORP / RSG bridge, notifications, progress bar, admin item panel'
version '1.1.0'
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
    'import.lua',       -- the bridge other scripts import: shared_script '@fks-utils/import.lua'
    'bridge/*.lua',
    'html/index.html',
    'html/style.css',
    'html/app.js',
    'html/fonts/*.woff2',
    'html/img/*',
    'html/pannel.png',
    'html/logo.*',      -- the server logo: html/logo.png (or .jpg / .webp / .svg)
}

-- + a framework (vorp_core or rsg-core) and an inventory (vorp_inventory, rsg-inventory or ox_inventory)
dependencies {
    'oxmysql',
}
