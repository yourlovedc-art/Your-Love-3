import {
  ButtonInteraction,
  ChatInputCommandInteraction,
  InteractionEditReplyOptions,
  InteractionReplyOptions,
  MessageFlags,
  RepliableInteraction,
  StringSelectMenuInteraction,
} from 'discord.js';

export function isUnknownOrAckedInteractionError(err: unknown): boolean {
  const anyErr = err as { code?: number; rawError?: { code?: number } } | null;
  const code = anyErr?.code ?? anyErr?.rawError?.code;
  return code === 10062 || code === 40060;
}

export async function safeDeferReply(
  interaction: ChatInputCommandInteraction | ButtonInteraction | StringSelectMenuInteraction,
  ephemeral = false
): Promise<boolean> {
  if (interaction.deferred || interaction.replied) {
    return true;
  }
  try {
    await interaction.deferReply(ephemeral ? { flags: MessageFlags.Ephemeral } : undefined);
    return true;
  } catch (err: any) {
    if (isUnknownOrAckedInteractionError(err)) {
      console.warn(
        `[SHADOW MUSIC] Could not defer reply for interaction ${interaction.id} (code ${err?.code ?? err?.rawError?.code}): expired (>3s) or handled by another bot instance.`
      );
      return false;
    }
    console.error('[SHADOW MUSIC] Unexpected deferReply error:', err);
    return false;
  }
}

export async function safeDeferUpdate(
  interaction: ButtonInteraction | StringSelectMenuInteraction
): Promise<boolean> {
  if (interaction.deferred || interaction.replied) {
    return true;
  }
  try {
    await interaction.deferUpdate();
    return true;
  } catch (err: any) {
    if (isUnknownOrAckedInteractionError(err)) {
      console.warn(
        `[SHADOW MUSIC] Could not defer update for component ${interaction.customId} (code ${err?.code ?? err?.rawError?.code}).`
      );
      return false;
    }
    console.error('[SHADOW MUSIC] Unexpected deferUpdate error:', err);
    return false;
  }
}

export async function safeRespond(
  interaction: RepliableInteraction,
  payload: string | InteractionReplyOptions
): Promise<void> {
  const normalized: InteractionReplyOptions =
    typeof payload === 'string' ? { content: payload } : { ...payload };

  try {
    if (interaction.deferred && !interaction.replied) {
      const editPayload: InteractionEditReplyOptions = {
        content: normalized.content,
        embeds: normalized.embeds,
        components: normalized.components,
        files: normalized.files,
        allowedMentions: normalized.allowedMentions,
      };
      await interaction.editReply(editPayload);
      return;
    }

    if (interaction.replied) {
      await interaction.followUp(normalized);
      return;
    }

    await interaction.reply(normalized);
  } catch (err) {
    if (isUnknownOrAckedInteractionError(err)) {
      return;
    }
    console.error('[SHADOW MUSIC] Failed to send interaction response:', err);
  }
}

const searchPickCache = new Map<string, { queryOrUri: string; expiresAt: number }>();

export function registerSearchPick(key: string, queryOrUri: string): string {
  const now = Date.now();
  for (const [k, v] of searchPickCache.entries()) {
    if (v.expiresAt <= now) searchPickCache.delete(k);
  }
  searchPickCache.set(key, { queryOrUri, expiresAt: now + 10 * 60 * 1000 });
  return key;
}

export function resolveSearchPick(value: string): string {
  const cached = searchPickCache.get(value);
  if (cached) {
    searchPickCache.delete(value);
    return cached.queryOrUri;
  }
  return value;
}

