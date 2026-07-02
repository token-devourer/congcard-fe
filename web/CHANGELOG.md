# Changelog

## 1.0.0 - 2026-06-20

First production LTS release of the CongCard frontend.

### Added

- Responsive private-room lobby and multiplayer game board.
- Standard, Last Stand, Jump In, Stacking, Wild +4 Challenge, One/Catch, and Batch Cards rules.
- Reconnect recovery, waiting-room spectators, away handling, and configurable absent-player behavior.
- Procedural synth BGM for lobby, gameplay, and the future Flip dark side.
- Independent persisted controls for music, gameplay sounds, and turn notifications.
- Vercel Analytics, Speed Insights, security headers, and Node 24 CI verification.

### Release Notes

- Rooms remain in memory and do not survive a backend restart.
- 0-7, Chaos, and Flip are visible as coming-soon modes but cannot be selected.
