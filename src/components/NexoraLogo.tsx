import React from 'react';

interface NexoraLogoProps {
  size?: 'sm' | 'md' | 'lg';
  showBadge?: boolean;
  variant?: 'compact' | 'full';
}

export const NexoraLogo: React.FC<NexoraLogoProps> = ({
  size = 'md',
  showBadge = true,
  variant = 'compact',
}) => {
  if (variant === 'full') {
    const fullWidths = {
      sm: 'w-28',
      md: 'w-40',
      lg: 'w-52',
    };

    return (
      <div className="inline-flex flex-col items-center gap-2 select-none">
        <div
          className={`${fullWidths[size]} rounded-2xl overflow-hidden bg-[#0B1221] border border-[#38BDF8]/30 shadow-[0_0_28px_rgba(56,189,248,0.22)]`}
        >
          <img
            src="/brand/nexora-logo-full.png"
            alt="Nexora AI Official Logo"
            className="w-full h-auto block object-contain"
          />
        </div>
        {showBadge && (
          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#6366F1]/20 text-[#A5B4FC] border border-[#6366F1]/30">
            v1.0
          </span>
        )}
      </div>
    );
  }

  const iconSizes = {
    sm: 'w-8 h-8',
    md: 'w-9 h-9',
    lg: 'w-14 h-14',
  };

  return (
    <div className="flex items-center gap-2 sm:gap-2.5 select-none shrink-0">
      <div
        className={`relative ${iconSizes[size]} rounded-xl overflow-hidden bg-[#0B1221] border border-[var(--nx-secondary-border)] shadow-[0_0_16px_rgba(56,189,248,0.22)] shrink-0`}
      >
        <img
          src="/brand/nexora-logo-icon.png"
          alt="Nexora AI"
          className="w-full h-full object-cover block"
        />
      </div>
      <div className="flex items-center gap-1.5 sm:gap-2">
        <span className="font-display font-bold tracking-wide text-[var(--nx-text-heading)] text-sm sm:text-base whitespace-nowrap">
          NEXORA{' '}
          <span className="bg-gradient-to-r from-[#06B6D4] via-[#3B82F6] to-[#7657F6] bg-clip-text text-transparent">
            Ai
          </span>
        </span>
        {showBadge && (
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-[var(--nx-accent-soft)] text-[var(--nx-accent-text)] border border-[var(--nx-accent-border)]">
            v1.0
          </span>
        )}
      </div>
    </div>
  );
};
