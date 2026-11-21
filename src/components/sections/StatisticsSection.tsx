import type { BotRuntimeStatus, BotStatsSnapshot } from '../../shared/types.ts';
import { formatMs } from '../../utils/format.ts';
import { ResilientImage } from '../ResilientImage.tsx';

interface StatisticsSectionProps {
  stats: BotStatsSnapshot;
  status: BotRuntimeStatus;
}

export function StatisticsSection({ stats, status }: StatisticsSectionProps) {
  const maxCmdCount = Math.max(1, ...stats.commandBreakdown.map((c) => c.count));

  return (
    <div className="space-y-6">
      {/* Persistent SQLite Metrics Grid */}
      <section className="grid grid-cols-2 lg:grid-cols-4 border border-zinc-800/80 rounded-lg bg-[#121215] divide-y lg:divide-y-0 lg:divide-x divide-zinc-800/80">
        <div className="p-6 space-y-1">
          <div className="text-xs text-zinc-400">Tracks Played (SQLite)</div>
          <div className="text-2xl font-semibold text-zinc-100 font-mono tabular-nums">
            {stats.tracksPlayed}
          </div>
        </div>
        <div className="p-6 space-y-1">
          <div className="text-xs text-zinc-400">Commands Executed</div>
          <div className="text-2xl font-semibold text-zinc-100 font-mono tabular-nums">
            {stats.commandsExecuted}
          </div>
        </div>
        <div className="p-6 space-y-1">
          <div className="text-xs text-zinc-400">Cumulative Audio Time</div>
          <div className="text-2xl font-semibold text-zinc-100 font-mono tabular-nums">
            {formatMs(stats.totalListeningMs)}
          </div>
        </div>
        <div className="p-6 space-y-1">
          <div className="text-xs text-zinc-400">Process Uptime</div>
          <div className="text-2xl font-semibold text-zinc-100 font-mono tabular-nums">
            {formatMs(status.uptimeMs)}
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Top Played Tracks */}
        <section className="lg:col-span-6 border border-zinc-800/80 rounded-lg bg-[#121215] overflow-hidden">
          <div className="px-6 py-4 border-b border-zinc-800/80">
            <h2 className="text-sm font-semibold text-zinc-100">Most Played Tracks</h2>
            <p className="text-xs text-zinc-500">Tracked persistently across sessions</p>
          </div>
          {stats.topTracks.length === 0 ? (
            <div className="p-8 text-center text-xs text-zinc-500">
              Play tracks in the Music Player or Discord to record track telemetry.
            </div>
          ) : (
            <div className="divide-y divide-zinc-800/60">
              {stats.topTracks.map((t, idx) => (
                <div key={`${t.title}_${idx}`} className="px-6 py-3 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="w-5 text-xs font-mono text-zinc-500 tabular-nums">{idx + 1}.</span>
                    <ResilientImage
                      src={t.artworkUrl}
                      alt={t.title}
                      className="w-9 h-9 rounded object-cover border border-zinc-800 shrink-0"
                    />
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-zinc-100 truncate">{t.title}</div>
                      <div className="text-xs text-zinc-500 truncate">{t.artist}</div>
                    </div>
                  </div>
                  <div className="text-xs font-mono text-zinc-300 tabular-nums shrink-0">
                    {t.plays} {t.plays === 1 ? 'play' : 'plays'}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Command Usage Breakdown */}
        <section className="lg:col-span-6 border border-zinc-800/80 rounded-lg bg-[#121215] overflow-hidden">
          <div className="px-6 py-4 border-b border-zinc-800/80">
            <h2 className="text-sm font-semibold text-zinc-100">Command Execution Breakdown</h2>
            <p className="text-xs text-zinc-500">Slash commands, dashboard actions, and embed buttons</p>
          </div>
          {stats.commandBreakdown.length === 0 ? (
            <div className="p-8 text-center text-xs text-zinc-500">
              No commands executed yet. Run a command in the Commands tab or Player.
            </div>
          ) : (
            <div className="p-6 space-y-3">
              {stats.commandBreakdown.map((cmd) => {
                const widthPct = Math.max(6, Math.round((cmd.count / maxCmdCount) * 100));
                return (
                  <div key={cmd.name} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-mono text-zinc-200">{cmd.name}</span>
                      <span className="font-mono text-zinc-400 tabular-nums">{cmd.count}</span>
                    </div>
                    <div className="h-1.5 w-full bg-zinc-900 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-zinc-200 rounded-full transition-all duration-200"
                        style={{ width: `${widthPct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
