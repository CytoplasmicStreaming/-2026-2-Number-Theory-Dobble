import React from 'react';
import { DobbleCard } from './dobbleMath';

interface DobbleCardViewProps {
  card: DobbleCard;
  size?: number; // width & height in px
  highlightSymbolId?: number | null;
  onSymbolClick?: (symbolId: number) => void;
  isInteractive?: boolean;
  stackCount?: number; // to show card thickness underneath
  label?: string;
  badge?: React.ReactNode;
  isWinner?: boolean;
}

export const DobbleCardView: React.FC<DobbleCardViewProps> = ({
  card,
  size = 180,
  highlightSymbolId = null,
  onSymbolClick,
  isInteractive = true,
  stackCount = 1,
  label,
  badge,
  isWinner = false,
}) => {
  // Stack layers to simulate physical card pile depth
  const stackLayers = Math.min(Math.max(stackCount - 1, 0), 3);

  return (
    <div className="flex flex-col items-center select-none relative">
      {/* Optional Top Badge or Label */}
      {label && (
        <div className="mb-1 flex items-center gap-1.5 z-10">
          <span className="text-xs font-bold text-slate-700 tracking-tight">
            {label}
          </span>
          {badge}
        </div>
      )}

      {/* Card Container with Stack Underlayers */}
      <div 
        className="relative group transition-transform duration-200"
        style={{ width: size, height: size }}
      >
        {/* Physical stack 3D layers underneath */}
        {stackLayers > 0 && Array.from({ length: stackLayers }).map((_, idx) => (
          <div
            key={idx}
            className="absolute rounded-full border border-slate-200 bg-white shadow-xs pointer-events-none"
            style={{
              width: size,
              height: size,
              top: (idx + 1) * 2,
              left: (idx % 2 === 0 ? 1 : -1) * (idx + 1) * 1.2,
              zIndex: 1 + idx,
              opacity: 0.9,
            }}
          />
        ))}

        {/* The Main Top Card */}
        <div
          className={`relative rounded-full border-2 transition-all duration-200 overflow-hidden shadow-md ${
            isWinner 
              ? 'border-amber-400 ring-4 ring-amber-300 shadow-amber-200' 
              : 'border-slate-200 hover:border-indigo-400'
          } bg-white`}
          style={{
            width: size,
            height: size,
            zIndex: 10,
          }}
        >
          {/* Subtle circular inner groove */}
          <div className="absolute inset-1.5 rounded-full border border-dashed border-slate-100 pointer-events-none" />

          {/* 8 Symbols placed at polar-jittered coordinates */}
          {card.items.map((item) => {
            const isHighlighted = highlightSymbolId === item.symbolId;
            const Icon = item.symbol.icon;
            // Proportion icon size cleanly based on card diameter
            const iconPixelSize = Math.max(14, Math.round((size / 7.2) * item.scale));

            return (
              <button
                key={item.symbolId}
                type="button"
                disabled={!isInteractive}
                onClick={(e) => {
                  e.stopPropagation();
                  if (onSymbolClick) {
                    onSymbolClick(item.symbolId);
                  }
                }}
                className={`absolute flex items-center justify-center rounded-full transition-all duration-150 ${
                  isInteractive
                    ? 'hover:scale-125 active:scale-95 hover:z-30 hover:shadow-md cursor-pointer'
                    : 'cursor-default'
                } ${
                  isHighlighted
                    ? 'ring-3 ring-amber-500 ring-offset-1 animate-bounce bg-amber-100/90 z-30 scale-120 shadow-md'
                    : ''
                }`}
                style={{
                  left: `calc(50% + ${item.xPercent}%)`,
                  top: `calc(50% + ${item.yPercent}%)`,
                  transform: `translate(-50%, -50%) rotate(${item.rotation}deg)`,
                  padding: Math.max(3, Math.round(iconPixelSize * 0.12)),
                  backgroundColor: isHighlighted ? '#fef3c7' : 'transparent',
                }}
                title={item.symbol.name}
              >
                <Icon
                  size={iconPixelSize}
                  color={item.symbol.color}
                  strokeWidth={2.4}
                  className="transition-transform drop-shadow-[0_1px_1px_rgba(0,0,0,0.1)]"
                />
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
