-- Channel Preset Seed Data
-- Run this after database migrations to populate default channel presets

-- Clear existing presets (optional - comment out if you want to preserve existing data)
DELETE FROM ChannelPreset;

-- Popular Sports Channels for Cable
INSERT INTO ChannelPreset (id, name, channelNumber, deviceType, "order", isActive, usageCount, createdAt, updatedAt) VALUES
('preset_cable_espn', 'ESPN', '206', 'cable', 1, 1, 0, datetime('now'), datetime('now')),
('preset_cable_espn2', 'ESPN2', '209', 'cable', 2, 1, 0, datetime('now'), datetime('now')),
('preset_cable_fs1', 'Fox Sports 1', '219', 'cable', 3, 1, 0, datetime('now'), datetime('now')),
('preset_cable_nfl', 'NFL Network', '212', 'cable', 4, 1, 0, datetime('now'), datetime('now')),
('preset_cable_nba', 'NBA TV', '216', 'cable', 5, 1, 0, datetime('now'), datetime('now')),
('preset_cable_mlb', 'MLB Network', '213', 'cable', 6, 1, 0, datetime('now'), datetime('now')),
('preset_cable_nhl', 'NHL Network', '215', 'cable', 7, 1, 0, datetime('now'), datetime('now')),
('preset_cable_fs2', 'Fox Sports 2', '618', 'cable', 8, 1, 0, datetime('now'), datetime('now')),
('preset_cable_tnt', 'TNT', '245', 'cable', 9, 1, 0, datetime('now'), datetime('now')),
('preset_cable_tbs', 'TBS', '247', 'cable', 10, 1, 0, datetime('now'), datetime('now')),
('preset_cable_abc', 'ABC', '7', 'cable', 11, 1, 0, datetime('now'), datetime('now')),
('preset_cable_cbs', 'CBS', '4', 'cable', 12, 1, 0, datetime('now'), datetime('now')),
('preset_cable_nbc', 'NBC', '5', 'cable', 13, 1, 0, datetime('now'), datetime('now')),
('preset_cable_fox', 'FOX', '11', 'cable', 14, 1, 0, datetime('now'), datetime('now'));

-- Popular Sports Channels for DirecTV
INSERT INTO ChannelPreset (id, name, channelNumber, deviceType, "order", isActive, usageCount, createdAt, updatedAt) VALUES
('preset_dtv_espn', 'ESPN', '206', 'directv', 1, 1, 0, datetime('now'), datetime('now')),
('preset_dtv_espn2', 'ESPN2', '209', 'directv', 2, 1, 0, datetime('now'), datetime('now')),
('preset_dtv_fs1', 'Fox Sports 1', '219', 'directv', 3, 1, 0, datetime('now'), datetime('now')),
('preset_dtv_nfl', 'NFL Network', '212', 'directv', 4, 1, 0, datetime('now'), datetime('now')),
('preset_dtv_redzone', 'NFL RedZone', '212', 'directv', 5, 1, 0, datetime('now'), datetime('now')),
('preset_dtv_nba', 'NBA TV', '216', 'directv', 6, 1, 0, datetime('now'), datetime('now')),
('preset_dtv_mlb', 'MLB Network', '213', 'directv', 7, 1, 0, datetime('now'), datetime('now')),
('preset_dtv_nhl', 'NHL Network', '215', 'directv', 8, 1, 0, datetime('now'), datetime('now')),
('preset_dtv_fs2', 'Fox Sports 2', '618', 'directv', 9, 1, 0, datetime('now'), datetime('now')),
('preset_dtv_tnt', 'TNT', '245', 'directv', 10, 1, 0, datetime('now'), datetime('now')),
('preset_dtv_tbs', 'TBS', '247', 'directv', 11, 1, 0, datetime('now'), datetime('now')),
('preset_dtv_abc', 'ABC', '7', 'directv', 12, 1, 0, datetime('now'), datetime('now')),
('preset_dtv_cbs', 'CBS', '4', 'directv', 13, 1, 0, datetime('now'), datetime('now')),
('preset_dtv_nbc', 'NBC', '5', 'directv', 14, 1, 0, datetime('now'), datetime('now')),
('preset_dtv_fox', 'FOX', '11', 'directv', 15, 1, 0, datetime('now'), datetime('now'));
