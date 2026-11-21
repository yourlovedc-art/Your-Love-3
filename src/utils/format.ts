export function formatMs(ms: number): string {
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

export function buildAsciiProgress(positionMs: number, durationMs: number, length = 16): string {
  if (!durationMs || durationMs <= 0) return 'LIVE ━━━━━━━━━━━━━━';
  const ratio = Math.max(0, Math.min(1, positionMs / durationMs));
  const idx = Math.min(length - 1, Math.floor(ratio * length));
  let out = '';
  for (let i = 0; i < length; i++) {
    out += i === idx ? '◆' : i < idx ? '━' : '─';
  }
  return out;
}

export function formatRelativeTime(timestamp: number): string {
  const diffSec = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  return `${Math.floor(diffHr / 24)}d ago`;
}
