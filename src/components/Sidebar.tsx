import {
  BarChart3,
  BookOpen,
  Disc3,
  Home,
  ListMusic,
  ListOrdered,
  Server,
  Settings,
  Terminal,
  X,
} from 'lucide-react';
import { ResilientImage } from './ResilientImage.tsx';

export type DashboardSection =
  | 'home'
  | 'player'
  | 'commands'
  | 'queue'
  | 'playlist'
  | 'servers'
  | 'settings'
  | 'statistics'
  | 'about';

interface SidebarProps {
  activeSection: DashboardSection;
  onSelectSection: (section: DashboardSection) => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
  samuraiLogoUrl: string;
  queueCount: number;
}

const NAV_ITEMS: Array<{ id: DashboardSection; label: string; icon: typeof Home }> = [
  { id: 'home', label: 'Home', icon: Home },
  { id: 'player', label: 'Music Player', icon: Disc3 },
  { id: 'commands', label: 'Commands', icon: Terminal },
  { id: 'queue', label: 'Queue', icon: ListOrdered },
  { id: 'playlist', label: 'Playlist', icon: ListMusic },
  { id: 'servers', label: 'Servers', icon: Server },
  { id: 'settings', label: 'Settings', icon: Settings },
  { id: 'statistics', label: 'Statistics', icon: BarChart3 },
  { id: 'about', label: 'About', icon: BookOpen },
];

export function Sidebar({
  activeSection,
  onSelectSection,
  mobileOpen,
  onCloseMobile,
  samuraiLogoUrl,
  queueCount,
}: SidebarProps) {
  const navContent = (
    <div className="flex flex-col h-full bg-[#0D0D0F] border-r border-zinc-800/80 w-64 select-none">
      {/* Brand Header with official Samurai logo */}
      <div className="flex items-center justify-between px-5 py-5 border-b border-zinc-800/80">
        <button
          type="button"
          onClick={() => {
            onSelectSection('home');
            onCloseMobile();
          }}
          className="flex items-center gap-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 rounded-md"
        >
          <ResilientImage
            src={samuraiLogoUrl}
            alt="Shadow Music Samurai emblem"
            className="w-10 h-10 rounded-md object-cover border border-zinc-700 shrink-0"
          />
          <div className="min-w-0">
            <div className="font-display text-sm font-semibold tracking-wider text-zinc-100 whitespace-nowrap">
              SHADOW MUSIC
            </div>
            <div className="text-[11px] text-zinc-500 truncate">Where Silence Meets Sound</div>
          </div>
        </button>
        <button
          type="button"
          onClick={onCloseMobile}
          aria-label="Close navigation"
          className="lg:hidden p-2 text-zinc-400 hover:text-zinc-100 rounded-md"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* 9 Dashboard Sections */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1" aria-label="Dashboard sections">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = activeSection === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                onSelectSection(item.id);
                onCloseMobile();
              }}
              className={`w-full flex items-center justify-between px-3 py-2.5 text-sm font-medium rounded-md transition-colors duration-150 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 ${
                isActive
                  ? 'bg-zinc-100 text-zinc-950'
                  : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900/70'
              }`}
            >
              <span className="flex items-center gap-3">
                <Icon className="w-4 h-4 shrink-0" />
                <span>{item.label}</span>
              </span>
              {item.id === 'queue' && queueCount > 0 && (
                <span
                  className={`font-mono text-xs tabular-nums ${
                    isActive ? 'text-zinc-700' : 'text-zinc-500'
                  }`}
                >
                  {queueCount}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Minimalist Samurai Footer */}
      <div className="px-5 py-4 border-t border-zinc-800/80 text-xs text-zinc-500">
        <div className="flex items-center justify-between">
          <span>Discord.js · Lavalink</span>
          <span className="font-mono text-zinc-400">SQLite</span>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <aside className="hidden lg:block shrink-0 h-screen sticky top-0">{navContent}</aside>
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-black/75 backdrop-blur-xs"
            onClick={onCloseMobile}
            aria-hidden="true"
          />
          <div className="relative z-10 h-full">{navContent}</div>
        </div>
      )}
    </>
  );
}
