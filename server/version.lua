---------------------------------------------------------------------------
-- Update checker of fks-utils itself (Config.VersionCheck)
---------------------------------------------------------------------------
local cfg = Config.VersionCheck or {}
if cfg.enabled then
    Bridge.CheckVersion(cfg.repo, { branch = cfg.branch, interval = cfg.interval })
end
