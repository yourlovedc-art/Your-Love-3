import { Menu } from 'lucide-react';
import type { GuildSettings } from '../shared/types.ts';
import type { DashboardSection } from './Sidebar.tsx';

interface TopBarProps {
  activeSection: DashboardSection;
  guilds: GuildSettings[];
  activeGuildId: string;
  onSelectGuild: (guildId: string) => void;
  onOpenMobileMenu: () => void;
  wsConnected: boolean;
  discordConnected: boolean;
}

const SECTION_LABELS: Record<DashboardSection, string> = {
  home: 'Home',
  player: 'Music Player',
  commands: 'Commands',
  queue: 'Queue',
  playlist: 'Playlist',
  servers: 'Servers',
  settings: 'Settings',
  statistics: 'Statistics',
  about: 'About',
};

export function TopBar({
  activeSection,
  guilds,
  activeGuildId,
  onSelectGuild,
  onOpenMobileMenu,
  wsConnected,
  discordConnected,
}: TopBarProps) {
  return (
    <header className="sticky top-0 z-30 h-16 bg-[#0A0A0B]/95 backdrop-blur-sm border-b border-zinc-800/80 px-4 lg:px-8 flex items-center justify-between gap-4">
      <div className="flex items-center gap-3 min-w-0">
        <button
          type="button"
          onClick={onOpenMobileMenu}
          aria-label="Open navigation menu"
          className="lg:hidden p-2 -ml-2 text-zinc-400 hover:text-zinc-100 rounded-md"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2 text-sm min-w-0">
          <span className="font-display text-zinc-400 hidden sm:inline whitespace-nowrap shrink-0">
            Shadow Music
          </span>
          <span className="text-zinc-600 hidden sm:inline" aria-hidden="true">
            /
          </span>
          <h1 className="text-zinc-100 font-semibold truncate">{SECTION_LABELS[activeSection]}</h1>
        </div>
      </div>

      <div className="flex items-center gap-4 shrink-0">
        <div className="hidden md:flex items-center gap-2 text-xs text-zinc-400 whitespace-nowrap shrink-0">
          <span>{discordConnected ? 'Bot Online' : 'Bot Token Standby'}</span>
          <span aria-hidden="true">·</span>
          <span>{wsConnected ? 'Live Sync' : 'Reconnecting'}</span>
        </div>

        <select
          aria-label="Select active server"
          value={activeGuildId}
          onChange={(e) => onSelectGuild(e.target.value)}
          className="bg-zinc-900 border border-zinc-800 text-zinc-100 text-xs rounded-md px-2.5 py-1.5 max-w-[200px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
        >
          {guilds.map((g) => (
            <option key={g.guildId} value={g.guildId}>
              {g.guildName}
            </option>
          ))}
        </select>
      </div>
    </header>
  );
}
