# Changelog

## 1.0.0 - 2026-06-20

First production LTS release of the authoritative CongCard server.

### Added

- Private room creation, lobby controls, reconnect recovery, spectators, waiting seats, and host migration.
- Standard, Last Stand, Jump In, Stacking, Wild +4 Challenge, One/Catch, and Batch Cards rules.
- Configurable delayed behavior for away and disconnected players.
- Request rate limits, strict environment validation, graceful shutdown, and versioned health reporting.
- Compiled Node 24 production bundle and automated CI release checks.

### Release Notes

- Room state is in memory and is cleared when the service restarts.
- Redis, database persistence, accounts, and public matchmaking are outside the v1.0.0 scope.
