export function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return '0:00';
  const totalSec = Math.floor(ms / 1000);
  const hours = Math.floor(totalSec / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

export function parseTimeToMs(input: string): number | null {
  const trimmed = input.trim().toLowerCase();
  if (!trimmed) return null;

  // Format: mm:ss or hh:mm:ss
  if (trimmed.includes(':')) {
    const parts = trimmed.split(':').map((p) => Number(p));
    if (parts.some((n) => Number.isNaN(n) || n < 0)) return null;
    if (parts.length === 2) {
      return (parts[0] * 60 + parts[1]) * 1000;
    }
    if (parts.length === 3) {
      return (parts[0] * 3600 + parts[1] * 60 + parts[2]) * 1000;
    }
    return null;
  }

  // Format: 1m30s, 90s, 2m
  const regex = /^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s?)?$/;
  const match = trimmed.match(regex);
  if (!match) return null;
  const h = Number(match[1] || 0);
  const m = Number(match[2] || 0);
  const s = Number(match[3] || 0);
  if (h === 0 && m === 0 && s === 0 && trimmed !== '0' && trimmed !== '0s') return null;
  return (h * 3600 + m * 60 + s) * 1000;
}

export function buildProgressBar(positionMs: number, durationMs: number, segments = 16): string {
  if (!durationMs || durationMs <= 0) {
    return 'LIVE ━━━━━━━━━━━━━━';
  }
  const ratio = Math.max(0, Math.min(1, positionMs / durationMs));
  const index = Math.min(segments - 1, Math.floor(ratio * segments));
  let bar = '';
  for (let i = 0; i < segments; i++) {
    bar += i === index ? '◆' : i < index ? '━' : '─';
  }
  return bar;
}

export function truncateText(text: string, maxLen = 48): string {
  if (text.length <= maxLen) return text;
  return `${text.slice(0, maxLen - 1)}…`;
}
