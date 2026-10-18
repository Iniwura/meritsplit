import React from 'react';

interface GenLayerSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  label?: string;
}

/**
 * GenLayer Consensus Spinner
 * - Outer counter-rotating hairline orbital track (#1c1c1c)
 * - Vivid neon volt (#ccff00) spinning segmented arc
 * - Inner pulsating GenLayer tripartite geometric core
 */
export const GenLayerSpinner: React.FC<GenLayerSpinnerProps> = ({
  size = 'md',
  className = '',
  label,
}) => {
  const sizeMap = {
    sm: { container: 'w-4 h-4', stroke: 2, center: 'w-1 h-1' },
    md: { container: 'w-6 h-6', stroke: 2.2, center: 'w-1.5 h-1.5' },
    lg: { container: 'w-10 h-10', stroke: 2.5, center: 'w-2.5 h-2.5' },
  };

  const currentSize = sizeMap[size];

  return (
    <div className={`inline-flex items-center gap-3 ${className}`}>
      <div className={`relative ${currentSize.container} flex items-center justify-center shrink-0`}>
        {/* Static hairline boundary track */}
        <svg
          className="absolute inset-0 w-full h-full"
          viewBox="0 0 40 40"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <circle
            cx="20"
            cy="20"
            r="16"
            stroke="#1c1c1c"
            strokeWidth={currentSize.stroke}
          />
        </svg>

        {/* Outer clockwise high-speed neon volt arc */}
        <svg
          className="absolute inset-0 w-full h-full animate-spin"
          style={{ animationDuration: '0.85s' }}
          viewBox="0 0 40 40"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <circle
            cx="20"
            cy="20"
            r="16"
            stroke="#ccff00"
            strokeWidth={currentSize.stroke}
            strokeDasharray="28 72"
            strokeLinecap="square"
          />
        </svg>

        {/* Counter-rotating secondary dimmer halo */}
        <svg
          className="absolute inset-0 w-full h-full animate-spin"
          style={{ animationDuration: '1.7s', animationDirection: 'reverse' }}
          viewBox="0 0 40 40"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <circle
            cx="20"
            cy="20"
            r="11"
            stroke="#ccff00"
            strokeOpacity="0.35"
            strokeWidth={currentSize.stroke * 0.8}
            strokeDasharray="16 53"
            strokeLinecap="round"
          />
        </svg>

        {/* Inner pulsating GenLayer node core */}
        <div
          className={`${currentSize.center} bg-[#ccff00] rounded-none rotate-45 animate-pulse`}
          style={{
            boxShadow: '0 0 8px rgba(204, 255, 0, 0.65)',
          }}
        />
      </div>

      {label && (
        <span className="font-mono text-xs uppercase tracking-widest text-[#bcbcbc]">
          {label}
        </span>
      )}
    </div>
  );
};
