# Changelog

## 2.1.0

- **Shared UI:** fks-core now draws the interface of every FKS script, so scripts ship no HTML and the server runs a
  single NUI. Scripts describe screens in Lua with the `UI` table (from `@fks-core/import.lua`) or the `UI*` exports
  and get the clicks back. fks-core alone handles the NUI focus: one script at a time, ESC, pause menu, death,
  clean-up when a script stops. Reference: `docs/UI-API.md`.
- Components: section, text, empty, row, grid, kv, badges, button, segmented, dials, slider, stats, list, cards,
  input, textarea, select, number, date, medals, seals, carousel, ring, facts, tier, chips, timers, thread,
  composer. Overlays:
  confirm / prompt dialogs, toasts, loading, camera stage and rail, cinematic bars, subtitles, caption, choose,
  side sheet (`UI.Sheet`), world point picker (`UI.Pick`) and the falling letters minigame (`UI.Minigame('keys')`).
- **Extensions:** a script can load its own JS / CSS into the fks-core NUI for screens that are not menus
  (`UI.Extend`, `UI.ExtSend`, `UI.OnExt`, `UI.ExtFocus`, `UI.HasFocus`) — used by the fks-chat feed.
  Conversation components `thread` and `composer`, colour picker `color`; extensions can draw core components
  with `api.render` (fks-hud `/hudsettings`).
- **Design system:** `html/theme.css` (fonts, colors, shared pieces) and one icon sprite for every FKS script.
  New `Config.Theme`: scale, side of the screen and colors of every FKS script in one place.
- Browser dev mode: open `html/index.html` outside the game to design screens with sample views.
- Nothing breaks: everything is new; notifications, progress bar and `/items` work as before.

## 2.0.0

- **Renamed from fks-utils to fks-core.** It is now the single dependency of every FKS script (bridge, notifications,
  progress bar, and the shared UI that comes next). Nothing else changed in this release.
- Scripts import `@fks-core/import.lua` and can require a minimum version with `fks_core_version 'x.y.z'`.
- **Breaking:** the fks-utils name is gone. Remove `fks-utils`, install `fks-core` and update every FKS script to its
  release for fks-core 2.0.0 (see "Coming from fks-utils" in the README).
- `/items` ACE renamed to `fks-core.items`. Events renamed to `fks-core:*`.

## 1.1.0

- **Bridge for the FKS scripts:** `shared_script '@fks-utils/import.lua'` gives a script the `Bridge` table for VORP / RSG
  with vorp_inventory, rsg-inventory or ox_inventory — players, money, permissions, admin commands, items, usable items,
  storages, notifications, progress bar, character loaded / job events and a GitHub version check. See the README.
- The `/items` panel uses the same bridge.
- Server console shows whether fks-utils is up to date or outdated compared with GitHub (`Config.VersionCheck`).
- Scripts can require a minimum version with `fks_utils_version 'x.y.z'` in their fxmanifest.lua.

## 1.0.0

First public release: notifications, progress bar, `/items` admin panel (VORP / RSG).
