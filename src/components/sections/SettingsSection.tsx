import { useEffect, useState } from 'react';
import { RotateCcw, Save, UserMinus, UserPlus } from 'lucide-react';
import type { BlacklistEntry, GuildSettings } from '../../shared/types.ts';

interface SettingsSectionProps {
  settings: GuildSettings;
  blacklist: BlacklistEntry[];
  onSaveSettings: (updated: Partial<GuildSettings>) => Promise<void>;
  onResetSettings: () => Promise<void>;
  onAddBlacklist: (userId: string, username: string, reason: string) => Promise<void>;
  onRemoveBlacklist: (userId: string) => Promise<void>;
}

export function SettingsSection({
  settings,
  blacklist,
  onSaveSettings,
  onResetSettings,
  onAddBlacklist,
  onRemoveBlacklist,
}: SettingsSectionProps) {
  const [form, setForm] = useState<GuildSettings>(settings);
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  const [blUserId, setBlUserId] = useState('');
  const [blUsername, setBlUsername] = useState('');
  const [blReason, setBlReason] = useState('');

  useEffect(() => {
    setForm(settings);
  }, [settings]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSavedMsg(null);
    try {
      await onSaveSettings(form);
      setSavedMsg('Server configuration saved to SQLite.');
    } finally {
      setSaving(false);
    }
  };

  const handleAddBlacklist = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!blUserId.trim() || !blUsername.trim()) return;
    await onAddBlacklist(blUserId.trim(), blUsername.trim(), blReason.trim() || 'Restricted by admin');
    setBlUserId('');
    setBlUsername('');
    setBlReason('');
  };

  return (
    <div className="space-y-6">
      <form
        onSubmit={handleSubmit}
        className="border border-zinc-800/80 rounded-lg bg-[#121215] p-6 space-y-6"
      >
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-zinc-800/80">
          <div>
            <h2 className="text-sm font-semibold text-zinc-100">
              Server Configuration · {settings.guildName}
            </h2>
            <p className="text-xs text-zinc-500">
              Changes persist in SQLite and synchronize with Discord slash commands (/247, /setdj, /setprefix, /setchannel)
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void onResetSettings()}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-zinc-300 border border-zinc-700 rounded-md hover:bg-zinc-900"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Defaults</span>
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-zinc-100 text-zinc-950 rounded-md hover:bg-white disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{saving ? 'Saving…' : 'Save Configuration'}</span>
            </button>
          </div>
        </div>

        {savedMsg && (
          <div className="px-4 py-2.5 text-xs text-zinc-200 bg-zinc-900 border border-zinc-700 rounded-md">
            {savedMsg}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-xs">
          {/* 24/7 Mode */}
          <label className="flex items-center justify-between p-4 rounded-md border border-zinc-800 bg-zinc-950/60 cursor-pointer">
            <div>
              <div className="font-semibold text-zinc-100">24/7 Persistent Voice Mode</div>
              <div className="text-zinc-500">Keep bot connected to voice channel indefinitely</div>
            </div>
            <input
              type="checkbox"
              checked={form.mode247}
              onChange={(e) => setForm({ ...form, mode247: e.target.checked })}
              className="w-4 h-4 accent-zinc-100"
            />
          </label>

          {/* Autoplay */}
          <label className="flex items-center justify-between p-4 rounded-md border border-zinc-800 bg-zinc-950/60 cursor-pointer">
            <div>
              <div className="font-semibold text-zinc-100">Autoplay Related Tracks</div>
              <div className="text-zinc-500">Queue recommended tracks automatically when queue ends</div>
            </div>
            <input
              type="checkbox"
              checked={form.autoplay}
              onChange={(e) => setForm({ ...form, autoplay: e.target.checked })}
              className="w-4 h-4 accent-zinc-100"
            />
          </label>

          {/* DJ Role Name */}
          <div className="space-y-1.5">
            <label className="block font-medium text-zinc-300">DJ Role Name</label>
            <input
              type="text"
              value={form.djRoleName || ''}
              onChange={(e) => setForm({ ...form, djRoleName: e.target.value || null })}
              placeholder="e.g. Shogun DJ (leave blank for everyone)"
              className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-md text-zinc-100 placeholder:text-zinc-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
            />
          </div>

          {/* DJ Role ID */}
          <div className="space-y-1.5">
            <label className="block font-medium text-zinc-300">Discord DJ Role ID (Optional)</label>
            <input
              type="text"
              value={form.djRoleId || ''}
              onChange={(e) => setForm({ ...form, djRoleId: e.target.value || null })}
              placeholder="123456789012345678"
              className="w-full px-3 py-2 font-mono bg-zinc-950 border border-zinc-800 rounded-md text-zinc-100 placeholder:text-zinc-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
            />
          </div>

          {/* Command Prefix */}
          <div className="space-y-1.5">
            <label className="block font-medium text-zinc-300">Legacy Command Prefix</label>
            <input
              type="text"
              maxLength={5}
              value={form.prefix}
              onChange={(e) => setForm({ ...form, prefix: e.target.value || '!' })}
              className="w-full px-3 py-2 font-mono bg-zinc-950 border border-zinc-800 rounded-md text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
            />
          </div>

          {/* Dedicated Music Channel */}
          <div className="space-y-1.5">
            <label className="block font-medium text-zinc-300">Music Channel Name</label>
            <input
              type="text"
              value={form.musicChannelName || ''}
              onChange={(e) => setForm({ ...form, musicChannelName: e.target.value || null })}
              placeholder="#shadow-music"
              className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-md text-zinc-100 placeholder:text-zinc-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
            />
          </div>

          {/* Default Volume */}
          <div className="space-y-1.5">
            <div className="flex justify-between">
              <label className="font-medium text-zinc-300">Default Volume</label>
              <span className="font-mono text-zinc-300 tabular-nums">{form.defaultVolume}%</span>
            </div>
            <input
              type="range"
              min={1}
              max={100}
              value={form.defaultVolume}
              onChange={(e) => setForm({ ...form, defaultVolume: Number(e.target.value) })}
              className="w-full samurai-range"
            />
          </div>

          {/* Inactivity Timeout */}
          <div className="space-y-1.5">
            <label className="block font-medium text-zinc-300">Inactivity Disconnect (seconds)</label>
            <input
              type="number"
              min={30}
              max={3600}
              value={form.inactivityTimeoutSec}
              onChange={(e) => setForm({ ...form, inactivityTimeoutSec: Number(e.target.value) || 300 })}
              className="w-full px-3 py-2 font-mono tabular-nums bg-zinc-950 border border-zinc-800 rounded-md text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
            />
          </div>

          {/* Vote Skip */}
          <label className="flex items-center justify-between p-4 rounded-md border border-zinc-800 bg-zinc-950/60 cursor-pointer">
            <div>
              <div className="font-semibold text-zinc-100">Vote Skip</div>
              <div className="text-zinc-500">Require majority listener agreement to skip without DJ</div>
            </div>
            <input
              type="checkbox"
              checked={form.voteSkipEnabled}
              onChange={(e) => setForm({ ...form, voteSkipEnabled: e.target.checked })}
              className="w-4 h-4 accent-zinc-100"
            />
          </label>

          {/* Custom Bot Status */}
          <div className="space-y-1.5">
            <label className="block font-medium text-zinc-300">Bot Presence Status</label>
            <input
              type="text"
              value={form.customStatus}
              onChange={(e) => setForm({ ...form, customStatus: e.target.value })}
              className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-md text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
            />
          </div>
        </div>
      </form>

      {/* Blacklist Manager */}
      <section className="border border-zinc-800/80 rounded-lg bg-[#121215] p-6 space-y-5">
        <div>
          <h3 className="text-sm font-semibold text-zinc-100">User Blacklist</h3>
          <p className="text-xs text-zinc-500">
            Users listed here are blocked from running Shadow Music commands in {settings.guildName}
          </p>
        </div>

        <form onSubmit={handleAddBlacklist} className="grid grid-cols-1 sm:grid-cols-12 gap-3 text-xs">
          <input
            type="text"
            value={blUserId}
            onChange={(e) => setBlUserId(e.target.value)}
            placeholder="Discord User ID"
            className="sm:col-span-3 px-3 py-2 font-mono bg-zinc-950 border border-zinc-800 rounded-md text-zinc-100 placeholder:text-zinc-600"
          />
          <input
            type="text"
            value={blUsername}
            onChange={(e) => setBlUsername(e.target.value)}
            placeholder="Username"
            className="sm:col-span-3 px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-md text-zinc-100 placeholder:text-zinc-600"
          />
          <input
            type="text"
            value={blReason}
            onChange={(e) => setBlReason(e.target.value)}
            placeholder="Reason"
            className="sm:col-span-4 px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-md text-zinc-100 placeholder:text-zinc-600"
          />
          <button
            type="submit"
            className="sm:col-span-2 inline-flex items-center justify-center gap-1.5 px-3 py-2 font-semibold bg-zinc-100 text-zinc-950 rounded-md hover:bg-white"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Block</span>
          </button>
        </form>

        {blacklist.length === 0 ? (
          <div className="text-xs text-zinc-500 py-2">No blacklisted users in this server.</div>
        ) : (
          <div className="divide-y divide-zinc-800/60 border border-zinc-800 rounded-md">
            {blacklist.map((entry) => (
              <div key={entry.userId} className="px-4 py-3 flex items-center justify-between gap-4 text-xs">
                <div>
                  <span className="font-semibold text-zinc-100">{entry.username}</span>{' '}
                  <span className="font-mono text-zinc-500">({entry.userId})</span>
                  <div className="text-zinc-400">{entry.reason}</div>
                </div>
                <button
                  type="button"
                  onClick={() => void onRemoveBlacklist(entry.userId)}
                  className="inline-flex items-center gap-1 px-3 py-1.5 border border-zinc-700 rounded text-zinc-200 hover:bg-zinc-900"
                >
                  <UserMinus className="w-3.5 h-3.5" />
                  <span>Unblock</span>
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
