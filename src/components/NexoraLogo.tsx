import React from 'react';

interface NexoraLogoProps {
  size?: 'sm' | 'md' | 'lg';
  showBadge?: boolean;
}

export const NexoraLogo: React.FC<NexoraLogoProps> = ({ size = 'md', showBadge = true }) => {
  const iconSizes = {
    sm: 'w-7 h-7 text-xs',
    md: 'w-9 h-9 text-sm',
    lg: 'w-14 h-14 text-base',
  };

  return (
    <div className="flex items-center gap-2.5 select-none">
      <div
        className={`relative ${iconSizes[size]} rounded-xl flex items-center justify-center bg-gradient-to-br from-[#6366F1] via-[#8B5CF6] to-[#4F46E5] shadow-[0_0_20px_rgba(99,102,241,0.4)] border border-white/20`}
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="w-5 h-5 text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.3)]"
        >
          {/* Stylized AI Brain / Neural Core */}
          <path d="M12 2a4 4 0 0 0-4 4v1a4 4 0 0 0-2 3.46v2.08a4 4 0 0 0 1 2.65V18a4 4 0 0 0 4 4h2a4 4 0 0 0 4-4v-2.81a4 4 0 0 0 1-2.65V10.46A4 4 0 0 0 16 7V6a4 4 0 0 0-4-4z" />
          <path d="M12 7v5" />
          <path d="M9 10h6" />
          <path d="M9 15h6" />
        </svg>
      </div>
      <div className="flex items-center gap-2">
        <span className="font-display font-bold tracking-tight text-white text-base">
          Nexora <span className="text-[#A5B4FC]">AI</span>
        </span>
        {showBadge && (
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-[#6366F1]/20 text-[#A5B4FC] border border-[#6366F1]/30">
            v1.0
          </span>
        )}
      </div>
    </div>
  );
};
