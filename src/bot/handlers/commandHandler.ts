import { adminCommands } from '../commands/admin/adminCommands.ts';
import { musicCommands } from '../commands/music/basicMusicCommands.ts';
import { playlistCommands } from '../commands/playlist/playlistCommands.ts';
import type { SlashCommandModule } from '../commands/types.ts';
import { utilityCommands } from '../commands/utility/utilityCommands.ts';

export function buildCommandMap(): Map<string, SlashCommandModule> {
  const all = [...musicCommands, ...playlistCommands, ...utilityCommands, ...adminCommands];
  const map = new Map<string, SlashCommandModule>();
  for (const mod of all) {
    map.set(mod.data.name, mod);
  }
  return map;
}

export function getSlashCommandPayloads() {
  const map = buildCommandMap();
  return Array.from(map.values()).map((cmd) => cmd.data.toJSON());
}
