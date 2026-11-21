import type { BotRuntimeStatus } from '../../shared/types.ts';
import { ResilientImage } from '../ResilientImage.tsx';

interface AboutSectionProps {
  status: BotRuntimeStatus;
  samuraiLogoUrl: string;
}

export function AboutSection({ status, samuraiLogoUrl }: AboutSectionProps) {
  return (
    <div className="space-y-6">
      <section className="border border-zinc-800/80 rounded-lg bg-[#121215] p-6 lg:p-8 flex flex-col md:flex-row items-start gap-8">
        <ResilientImage
          src={samuraiLogoUrl}
          alt="Shadow Music Samurai Emblem"
          className="w-36 h-36 rounded-lg object-cover border border-zinc-700 shrink-0"
        />
        <div className="space-y-3">
          <h2 className="font-display text-2xl font-semibold text-zinc-100">SHADOW MUSIC</h2>
          <p className="text-sm text-zinc-300 font-medium">Where Silence Meets Sound.</p>
          <p className="text-xs text-zinc-400 leading-relaxed max-w-2xl">
            A monochrome Japanese Samurai Discord music bot built with Discord.js v14, Kazagumo +
            Shoukaku for Lavalink v4 audio streaming, and better-sqlite3 for persistent guild
            settings, playlists, music history, favorites, and blacklists using Discord bot-token
            authentication only.
          </p>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Samurai Logo Replacement Guide */}
        <section className="border border-zinc-800/80 rounded-lg bg-[#121215] p-6 space-y-3">
          <h3 className="text-sm font-semibold text-zinc-100">Official Samurai Artwork Placement</h3>
          <p className="text-xs text-zinc-400 leading-relaxed">
            To replace the generated Samurai emblem with your own uploaded Samurai artwork across the
            local assets and Discord embeds, overwrite these paths:
          </p>
          <div className="p-3 rounded bg-zinc-950 border border-zinc-800 font-mono text-xs text-zinc-300 space-y-1">
            <div>src/assets/images/samurai_logo_1795268379491.jpg</div>
            <div>assets/samurai-logo.jpg</div>
          </div>
          <p className="text-xs text-zinc-500">
            Upload your black-and-white Samurai image as your bot avatar in the Discord Developer Portal
            under Bot → Icon.
          </p>
        </section>

        {/* Discord Bot-Only Setup Guide */}
        <section className="border border-zinc-800/80 rounded-lg bg-[#121215] p-6 space-y-3">
          <h3 className="text-sm font-semibold text-zinc-100">Discord Bot-Only Authentication</h3>
          <p className="text-xs text-zinc-400 leading-relaxed">
            Shadow Music authenticates exclusively with your Discord Bot Token and Application ID—no
            OAuth2 login, client secret, or redirect URI is required.
          </p>
          <div className="p-3 rounded bg-zinc-950 border border-zinc-800 font-mono text-xs text-zinc-300 space-y-1">
            <div>DISCORD_BOT_TOKEN=your_bot_token</div>
            <div>DISCORD_CLIENT_ID=your_application_id</div>
            <div>LAVALINK_HOST=127.0.0.1 · LAVALINK_PORT=2333</div>
          </div>
          <div className="text-xs text-zinc-500 space-y-1 pt-1">
            <div>1. Set DISCORD_BOT_TOKEN and DISCORD_CLIENT_ID in environment secrets.</div>
            <div>2. Start Lavalink v4 using lavalink/application.yml on port 2333.</div>
            <div>3. Run npm run deploy-commands to register all 42 slash commands.</div>
            <div>
              Current Gateway: {status.discordConnected ? 'Connected' : 'Standby'} · Node:{' '}
              {status.lavalinkNodeName}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
