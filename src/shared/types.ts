export type LoopMode = 'off' | 'song' | 'queue';

export type TrackSource = 'synth' | 'upload' | 'lavalink';

export interface TrackRequester {
  id: string;
  username: string;
  avatarUrl?: string;
}

export interface TrackItem {
  id: string;
  title: string;
  artist: string;
  durationMs: number;
  artworkUrl: string;
  uri: string;
  source: TrackSource;
  synthPreset?: string;
  audioUrl?: string;
  requestedBy: TrackRequester;
  addedAt: number;
}

export interface GuildSettings {
  guildId: string;
  guildName: string;
  guildIcon: string | null;
  mode247: boolean;
  djRoleId: string | null;
  djRoleName: string | null;
  prefix: string;
  musicChannelId: string | null;
  musicChannelName: string | null;
  defaultVolume: number;
  autoplay: boolean;
  voteSkipEnabled: boolean;
  voteSkipRatio: number;
  inactivityTimeoutSec: number;
  customStatus: string;
  updatedAt: number;
}

export interface GuildPlayerState {
  guildId: string;
  guildName: string;
  voiceChannelName: string;
  textChannelName: string;
  connected: boolean;
  playing: boolean;
  paused: boolean;
  positionMs: number;
  volume: number;
  loop: LoopMode;
  shuffle: boolean;
  autoplay: boolean;
  voteSkipCount: number;
  voteSkipRequired: number;
  currentTrack: TrackItem | null;
  queue: TrackItem[];
  previousTracks: TrackItem[];
  updatedAt: number;
}

export interface PlaylistRecord {
  id: string;
  guildId: string;
  ownerId: string;
  ownerName: string;
  name: string;
  description: string;
  tracks: TrackItem[];
  createdAt: number;
  updatedAt: number;
}

export interface HistoryEntry {
  id: string;
  guildId: string;
  track: TrackItem;
  playedAt: number;
}

export interface FavoriteEntry {
  id: string;
  guildId: string;
  userId: string;
  track: TrackItem;
  savedAt: number;
}

export interface BlacklistEntry {
  guildId: string;
  userId: string;
  username: string;
  reason: string;
  addedBy: string;
  addedAt: number;
}

export interface BotCommandMeta {
  name: string;
  category: 'music' | 'playlist' | 'utility' | 'admin';
  syntax: string;
  description: string;
  permissions: string;
  djOnly: boolean;
  examples: string[];
}

export interface BotStatsSnapshot {
  tracksPlayed: number;
  commandsExecuted: number;
  totalListeningMs: number;
  topTracks: Array<{ title: string; artist: string; plays: number; artworkUrl: string }>;
  commandBreakdown: Array<{ name: string; count: number }>;
}

export interface BotRuntimeStatus {
  discordConnected: boolean;
  botUsername: string;
  botTag: string;
  botAvatar: string;
  clientId: string;
  lavalinkConnected: boolean;
  lavalinkNodeName: string;
  pingMs: number;
  uptimeMs: number;
  guildCount: number;
  activePlayers: number;
}

export interface FullDashboardState {
  status: BotRuntimeStatus;
  guilds: GuildSettings[];
  activeGuildId: string;
  player: GuildPlayerState;
  playlists: PlaylistRecord[];
  history: HistoryEntry[];
  favorites: FavoriteEntry[];
  blacklist: BlacklistEntry[];
  stats: BotStatsSnapshot;
  catalog: TrackItem[];
}
