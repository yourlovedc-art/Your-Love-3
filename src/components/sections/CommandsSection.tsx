import { useMemo, useState } from 'react';
import { Play, Search, Terminal } from 'lucide-react';
import type { BotCommandMeta } from '../../shared/types.ts';

interface CommandsSectionProps {
  commands: BotCommandMeta[];
  onExecuteCommand: (rawCommand: string) => Promise<{ ok: boolean; message: string }>;
}

type CategoryFilter = 'all' | 'music' | 'playlist' | 'utility' | 'admin';

export function CommandsSection({ commands, onExecuteCommand }: CommandsSectionProps) {
  const [category, setCategory] = useState<CategoryFilter>('all');
  const [search, setSearch] = useState('');
  const [consoleInput, setConsoleInput] = useState('/play Moonlight Over Kamakura');
  const [consoleLog, setConsoleLog] = useState<Array<{ cmd: string; res: string; ok: boolean }>>([]);
  const [running, setRunning] = useState(false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return commands.filter((c) => {
      if (category !== 'all' && c.category !== category) return false;
      if (!q) return true;
      return (
        c.name.toLowerCase().includes(q) ||
        c.syntax.toLowerCase().includes(q) ||
        c.description.toLowerCase().includes(q)
      );
    });
  }, [commands, category, search]);

  const handleRun = async (cmdString: string) => {
    const clean = cmdString.trim();
    if (!clean || running) return;
    setRunning(true);
    try {
      const result = await onExecuteCommand(clean);
      setConsoleLog((prev) => [{ cmd: clean, res: result.message, ok: result.ok }, ...prev].slice(0, 8));
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Live Slash Command Console */}
      <section className="border border-zinc-800/80 rounded-lg bg-[#121215] p-6 space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-sm font-semibold text-zinc-100">Interactive Command Console</h2>
            <p className="text-xs text-zinc-500">
              Execute Shadow Music commands directly against the server state (/play, /volume 80, /loop song, /shuffle, /247, /ping)
            </p>
          </div>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void handleRun(consoleInput);
          }}
          className="flex flex-col sm:flex-row gap-3"
        >
          <div className="relative flex-1">
            <Terminal className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={consoleInput}
              onChange={(e) => setConsoleInput(e.target.value)}
              placeholder="/play Moonlight Over Kamakura"
              className="w-full pl-9 pr-4 py-2.5 text-sm font-mono bg-zinc-950 border border-zinc-800 rounded-md text-zinc-100 placeholder:text-zinc-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
            />
          </div>
          <button
            type="submit"
            disabled={running}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 text-xs font-semibold bg-zinc-100 text-zinc-950 rounded-md hover:bg-white transition-colors disabled:opacity-50 whitespace-nowrap shrink-0"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>{running ? 'Running…' : 'Run Command'}</span>
          </button>
        </form>

        {consoleLog.length > 0 && (
          <div className="bg-zinc-950 border border-zinc-800 rounded-md divide-y divide-zinc-800/60">
            {consoleLog.map((entry, idx) => (
              <div key={idx} className="px-4 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                <span className="font-mono text-zinc-300">{entry.cmd}</span>
                <span className={entry.ok ? 'text-zinc-400' : 'text-red-400'}>{entry.res}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Filter Bar & 42-Command Codex Table */}
      <section className="border border-zinc-800/80 rounded-lg bg-[#121215] overflow-hidden">
        <div className="p-5 border-b border-zinc-800/80 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-1 p-1 bg-zinc-950 border border-zinc-800 rounded-md">
            {(
              [
                ['all', `All (${commands.length})`],
                ['music', 'Music (19)'],
                ['playlist', 'Playlist (7)'],
                ['utility', 'Utility (8)'],
                ['admin', 'Admin (8)'],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setCategory(id)}
                className={`px-3 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 ${
                  category === id
                    ? 'bg-zinc-100 text-zinc-950'
                    : 'text-zinc-400 hover:text-zinc-100'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="relative w-full md:w-72">
            <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search slash commands…"
              className="w-full pl-9 pr-3 py-2 text-xs bg-zinc-950 border border-zinc-800 rounded-md text-zinc-100 placeholder:text-zinc-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-zinc-800 text-[11px] uppercase tracking-wider text-zinc-500">
                <th className="py-3 px-5 font-medium">Command</th>
                <th className="py-3 px-4 font-medium">Category</th>
                <th className="py-3 px-4 font-medium">Description</th>
                <th className="py-3 px-4 font-medium">Permissions</th>
                <th className="py-3 px-5 font-medium text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60 text-xs">
              {filtered.map((cmd) => (
                <tr key={cmd.name} className="hover:bg-zinc-900/40 transition-colors">
                  <td className="py-3 px-5 font-mono text-zinc-100 whitespace-nowrap">
                    {cmd.syntax}
                  </td>
                  <td className="py-3 px-4 text-zinc-400 capitalize whitespace-nowrap">
                    {cmd.category}
                  </td>
                  <td className="py-3 px-4 text-zinc-300 max-w-md">{cmd.description}</td>
                  <td className="py-3 px-4 text-zinc-400 whitespace-nowrap">
                    {cmd.permissions}
                    {cmd.djOnly ? ' · DJ' : ''}
                  </td>
                  <td className="py-3 px-5 text-right whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => {
                        const sample = cmd.examples[0] || `/${cmd.name}`;
                        setConsoleInput(sample);
                        void handleRun(sample);
                      }}
                      className="px-2.5 py-1 text-xs font-medium text-zinc-200 border border-zinc-700 rounded hover:bg-zinc-800 transition-colors"
                    >
                      Test
                    </button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-zinc-500">
                    No commands match "{search}".
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
