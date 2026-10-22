# Changelog

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
