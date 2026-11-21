import { useState } from 'react';
import { Check, ExternalLink, Plus, Server } from 'lucide-react';
import type { BotRuntimeStatus, GuildSettings } from '../../shared/types.ts';
import { ResilientImage } from '../ResilientImage.tsx';

interface ServersSectionProps {
  guilds: GuildSettings[];
  activeGuildId: string;
  status: BotRuntimeStatus;
  samuraiLogoUrl: string;
  onSelectGuild: (guildId: string) => void;
  onCreateGuild: (guildName: string) => Promise<void>;
}

export function ServersSection({
  guilds,
  activeGuildId,
  status,
  samuraiLogoUrl,
  onSelectGuild,
  onCreateGuild,
}: ServersSectionProps) {
  const [guildName, setGuildName] = useState('');
  const [creating, setCreating] = useState(false);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!guildName.trim() || creating) return;
    setCreating(true);
    try {
      await onCreateGuild(guildName.trim());
      setGuildName('');
    } finally {
      setCreating(false);
    }
  };

  const inviteUrl = status.clientId
    ? `https://discord.com/api/oauth2/authorize?client_id=${status.clientId}&permissions=3147776&scope=bot%20applications.commands`
    : 'https://discord.com/developers/applications';

  return (
    <div className="space-y-6">
      {/* Bot Status & Invite Banner (Bot-Token Auth Only) */}
      <section className="border border-zinc-800/80 rounded-lg bg-[#121215] p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <h2 className="text-sm font-semibold text-zinc-100">Discord Bot Servers</h2>
          <p className="text-xs text-zinc-400">
            {status.discordConnected
              ? `Connected as ${status.botTag} across ${status.guildCount} Discord servers via DISCORD_BOT_TOKEN.`
              : 'Servers automatically sync here when DISCORD_BOT_TOKEN is active.'}
          </p>
        </div>

        <a
          href={inviteUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-zinc-100 text-zinc-950 rounded-md hover:bg-white transition-colors shrink-0"
        >
          <span>{status.clientId ? 'Invite Bot to Server' : 'Discord Developer Portal'}</span>
          <ExternalLink className="w-3.5 h-3.5" />
        </a>
      </section>

      {/* Register Local Server Profile */}
      <section className="border border-zinc-800/80 rounded-lg bg-[#121215] p-5">
        <form onSubmit={handleCreate} className="flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            value={guildName}
            onChange={(e) => setGuildName(e.target.value)}
            placeholder="Register a Discord server profile name…"
            className="flex-1 px-3 py-2 text-xs bg-zinc-950 border border-zinc-800 rounded-md text-zinc-100 placeholder:text-zinc-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
          />
          <button
            type="submit"
            disabled={creating}
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold bg-zinc-100 text-zinc-950 rounded-md hover:bg-white disabled:opacity-50"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Server Profile</span>
          </button>
        </form>
      </section>

      {/* Guild Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {guilds.map((g) => {
          const isActive = g.guildId === activeGuildId;
          return (
            <div
              key={g.guildId}
              className={`border rounded-lg p-5 bg-[#121215] flex flex-col justify-between gap-4 transition-colors ${
                isActive ? 'border-zinc-400' : 'border-zinc-800/80'
              }`}
            >
              <div className="flex items-start gap-3">
                <ResilientImage
                  src={g.guildIcon || samuraiLogoUrl}
                  alt={g.guildName}
                  className="w-11 h-11 rounded-md object-cover border border-zinc-800 shrink-0"
                />
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-zinc-100 truncate">{g.guildName}</div>
                  <div className="text-xs text-zinc-500 font-mono truncate">ID: {g.guildId}</div>
                  <div className="mt-1 text-xs text-zinc-400">
                    {g.mode247 ? '24/7 Active' : 'Auto-Disconnect'} · Prefix {g.prefix} · Vol{' '}
                    {g.defaultVolume}%
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => onSelectGuild(g.guildId)}
                className={`w-full py-2 px-3 text-xs font-semibold rounded-md inline-flex items-center justify-center gap-1.5 transition-colors ${
                  isActive
                    ? 'bg-zinc-100 text-zinc-950'
                    : 'border border-zinc-700 text-zinc-200 hover:bg-zinc-900'
                }`}
              >
                {isActive ? <Check className="w-3.5 h-3.5" /> : <Server className="w-3.5 h-3.5" />}
                <span>{isActive ? 'Active Server' : 'Select Server'}</span>
              </button>
            </div>
          );
        })}
      </div>

      {/* Live Discord Bot Status Summary */}
      <section className="border border-zinc-800/80 rounded-lg bg-[#121215] p-5 text-xs text-zinc-400 flex flex-wrap items-center justify-between gap-4">
        <div>
          Bot Identity: <span className="text-zinc-200 font-medium">{status.botTag}</span> · Gateway:{' '}
          <span className="text-zinc-200">{status.discordConnected ? 'Connected' : 'Standby'}</span>
        </div>
        <div className="font-mono tabular-nums">
          Lavalink: {status.lavalinkNodeName} ({status.lavalinkConnected ? 'Ready' : 'Standby'})
        </div>
      </section>
    </div>
  );
}
