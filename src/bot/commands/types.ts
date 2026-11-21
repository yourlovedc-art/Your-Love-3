import type {
  ChatInputCommandInteraction,
  Client,
  SlashCommandBuilder,
  SlashCommandOptionsOnlyBuilder,
  SlashCommandSubcommandsOnlyBuilder,
} from 'discord.js';
import type { Kazagumo } from 'kazagumo';
import type { BotConfig } from '../config/botConfig.ts';
import type { ShadowDatabase } from '../database/sqlite.ts';
import type { GuildMusicBridge } from '../music/playerManager.ts';

export interface BotContext {
  client: Client;
  kazagumo: Kazagumo;
  db: ShadowDatabase;
  bridge: GuildMusicBridge;
  config: BotConfig;
  startedAt: number;
}

export interface SlashCommandModule {
  data: SlashCommandBuilder | SlashCommandOptionsOnlyBuilder | SlashCommandSubcommandsOnlyBuilder;
  execute: (interaction: ChatInputCommandInteraction, ctx: BotContext) => Promise<void>;
}
