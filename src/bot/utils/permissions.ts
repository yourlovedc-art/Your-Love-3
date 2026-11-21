import { ChatInputCommandInteraction, GuildMember, PermissionsBitField, VoiceBasedChannel } from 'discord.js';
import type { ShadowDatabase } from '../database/sqlite.ts';

export interface VoiceValidationResult {
  ok: boolean;
  error?: string;
  voiceChannel?: VoiceBasedChannel;
}

export function validateUserVoiceChannel(
  interaction: ChatInputCommandInteraction,
  requireSameChannel = true
): VoiceValidationResult {
  const member = interaction.member as GuildMember | null;
  const voiceChannel = member?.voice?.channel;

  if (!voiceChannel) {
    return {
      ok: false,
      error: 'You must join a voice channel before invoking Shadow Music.',
    };
  }

  const botMember = interaction.guild?.members.me;
  if (requireSameChannel && botMember?.voice?.channelId && botMember.voice.channelId !== voiceChannel.id) {
    return {
      ok: false,
      error: `Shadow Music is currently bound to <#${botMember.voice.channelId}>. Join that voice channel to control playback.`,
    };
  }

  const permissions = voiceChannel.permissionsFor(botMember ?? interaction.client.user);
  if (!permissions?.has(PermissionsBitField.Flags.Connect) || !permissions?.has(PermissionsBitField.Flags.Speak)) {
    return {
      ok: false,
      error: `I lack Connect or Speak permissions in <#${voiceChannel.id}>.`,
    };
  }

  return { ok: true, voiceChannel };
}

export function checkDjPermission(
  member: GuildMember | null,
  db: ShadowDatabase,
  guildId: string
): { allowed: boolean; reason?: string } {
  if (!member) return { allowed: false, reason: 'Member context unavailable.' };
  if (db.isBlacklisted(guildId, member.id)) {
    return { allowed: false, reason: 'You are blacklisted from using Shadow Music in this server.' };
  }

  if (
    member.permissions.has(PermissionsBitField.Flags.Administrator) ||
    member.permissions.has(PermissionsBitField.Flags.ManageGuild)
  ) {
    return { allowed: true };
  }

  const settings = db.getGuildSettings(guildId);
  if (!settings.djRoleId) {
    return { allowed: true };
  }

  if (member.roles.cache.has(settings.djRoleId)) {
    return { allowed: true };
  }

  // Allow if user is the only non-bot member in the voice channel
  const vc = member.voice?.channel;
  if (vc) {
    const humanListeners = vc.members.filter((m) => !m.user.bot).size;
    if (humanListeners <= 1) return { allowed: true };
  }

  return {
    allowed: false,
    reason: `This command requires the **${settings.djRoleName || 'DJ'}** role or Manage Server permissions.`,
  };
}

export function checkAdminPermission(member: GuildMember | null): boolean {
  if (!member) return false;
  return (
    member.permissions.has(PermissionsBitField.Flags.Administrator) ||
    member.permissions.has(PermissionsBitField.Flags.ManageGuild)
  );
}
