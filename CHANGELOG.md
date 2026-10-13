# Changelog

## 1.1.0

- **Bridge for the FKS scripts:** `shared_script '@fks-utils/import.lua'` gives a script the `Bridge` table for VORP / RSG
  with vorp_inventory, rsg-inventory or ox_inventory — players, money, permissions, admin commands, items, usable items,
  storages, notifications, progress bar, character loaded / job events and a GitHub version check. See the README.
- The `/items` panel uses the same bridge.
- Server console shows whether fks-utils is up to date or outdated compared with GitHub (`Config.VersionCheck`).
- Scripts can require a minimum version with `fks_utils_version 'x.y.z'` in their fxmanifest.lua.

## 1.0.0

First public release: notifications, progress bar, `/items` admin panel (VORP / RSG).
