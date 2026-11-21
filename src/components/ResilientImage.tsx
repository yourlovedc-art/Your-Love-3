import { useState } from 'react';
import { Disc3 } from 'lucide-react';

interface ResilientImageProps {
  src: string;
  alt: string;
  className?: string;
  fallbackLabel?: string;
}

export function ResilientImage({ src, alt, className = '', fallbackLabel }: ResilientImageProps) {
  const [failed, setFailed] = useState(false);

  if (failed || !src) {
    return (
      <div
        className={`flex flex-col items-center justify-center bg-zinc-900 border border-zinc-800 text-zinc-500 ${className}`}
        role="img"
        aria-label={alt}
      >
        <Disc3 className="w-6 h-6 mb-1 text-zinc-400" />
        {fallbackLabel && <span className="text-[11px] truncate max-w-[90%] px-2">{fallbackLabel}</span>}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={className}
    />
  );
}
