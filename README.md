# fks-utils

Dependência partilhada dos scripts FKS (VORP / RSG). Junta utilidades que vamos acrescentando com o tempo.

```lua
-- fxmanifest.lua do script
dependencies { 'fks-utils' }
```

## Notificações

Painel `html/pannel.png` com o logótipo do servidor à esquerda. Para trocar o logo basta substituir
`html/logo.png` (também aceita `logo.webp`, `logo.jpg`, `logo.jpeg` ou `logo.svg`). Se não houver logo, o painel aparece só com o texto.

```lua
-- client
exports['fks-utils']:Notify('Mensagem', 'success', 5000, 'Título')
exports['fks-utils']:Notify({ title = 'Título', description = 'Mensagem', type = 'error', duration = 5000 })

-- server (source = -1 envia para todos)
exports['fks-utils']:Notify(source, 'Mensagem', 'success')
TriggerClientEvent('fks-utils:client:notify', source, { title = 'Título', description = 'Mensagem', type = 'warning' })
```

`type`: `inform` · `success` · `error` · `warning` (também aceita os nomes do ox_lib / RSG: `info`, `primary`, `warn`).
Posição, duração, máximo no ecrã e som em `Config.Notify`.

## Progress bar

Bloqueia até acabar; devolve `true` se chegou ao fim e `false` se foi cancelada (tecla X, morte ou `CancelProgress`).
Aceita a mesma tabela do `lib.progressBar` do ox_lib.

```lua
local done = exports['fks-utils']:Progress({
    duration = 5000,
    label = 'A ligar a ferida...',
    canCancel = true,
    useWhileDead = false,
    disable = { move = true, sprint = true, combat = true, mount = true, mouse = false },
    anim = { dict = 'mech_inventory@crafting@fallbacks', clip = 'full_craft_and_stow', flag = 17 }, -- ou { scenario = 'WORLD_HUMAN_CROUCH_INSPECT' }
    prop = { model = 'p_bottlebeer01x', bone = 'SKEL_R_HAND', pos = vec3(0.0, 0.0, 0.0), rot = vec3(0.0, 0.0, 0.0) },
})

exports['fks-utils']:ProgressActive()  -- true enquanto há uma barra a correr
exports['fks-utils']:CancelProgress()  -- cancela a barra atual
```

## /items (admin)

Painel com todos os items, armas e munição do inventário (vorp_inventory, rsg-inventory ou ox_inventory), com imagem,
pesquisa e filtro por categoria. Clicar num item → entregar a si próprio ou a outro jogador, com a quantidade.

Quem pode usar (`Config.Items`):
- VORP: grupos em `vorpGroups` (por defeito `admin`, `superadmin`)
- RSG: permissão `rsgPermission` (por defeito `admin`, e `god`)
- quem tiver a ACE `fks-utils.items` ou a ACE `command` (o `group.admin` do server.cfg já a tem)

O servidor volta a validar a permissão, o item, a quantidade e o jogador em cada entrega, e escreve no console quem deu o quê a quem (`logGives`).

## Licença

GNU GPL v3 ou posterior (ver `LICENSE`).
