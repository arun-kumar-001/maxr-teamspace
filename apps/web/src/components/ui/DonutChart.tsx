import * as React from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { cn } from '@/lib/utils';

export interface DonutChartSegment {
  value: number;
  /** CSS color or token variable, e.g. var(--primary). */
  color: string;
  label: string;
  [key: string]: unknown;
}

export interface DonutChartProps extends React.HTMLAttributes<HTMLDivElement> {
  data: DonutChartSegment[];
  totalValue?: number;
  size?: number;
  strokeWidth?: number;
  /** Desired visible empty gap in px between multi-segment arcs (accounts for round endcaps). */
  segmentGap?: number;
  /** Render a subtle inner hairline ring for dial-style visual polish. */
  showInnerRing?: boolean;
  animationDuration?: number;
  animationDelayPerSegment?: number;
  highlightOnHover?: boolean;
  /** Optional externally hovered/focused segment label (e.g. from legend hover). */
  hoveredLabel?: string | null;
  /** Background ring stroke color; defaults to design token --track. */
  trackColor?: string;
  centerContent?: React.ReactNode;
  /** Callback fired when hovered/focused segment changes. */
  onSegmentHover?: (segment: DonutChartSegment | null) => void;
}

const DonutChart = React.forwardRef<HTMLDivElement, DonutChartProps>(
  (
    {
      data,
      totalValue: propTotalValue,
      size = 200,
      strokeWidth = 20,
      segmentGap = 8,
      showInnerRing = true,
      animationDuration = 0.85,
      animationDelayPerSegment = 0.06,
      highlightOnHover = true,
      hoveredLabel,
      trackColor = 'var(--track)',
      centerContent,
      onSegmentHover,
      className,
      ...props
    },
    ref,
  ) => {
    const prefersReducedMotion = useReducedMotion();
    const [hoveredSegment, setHoveredSegment] = React.useState<DonutChartSegment | null>(null);
    const onSegmentHoverRef = React.useRef(onSegmentHover);
    onSegmentHoverRef.current = onSegmentHover;

    const internalTotalValue = React.useMemo(
      () => propTotalValue ?? data.reduce((sum, segment) => sum + segment.value, 0),
      [data, propTotalValue],
    );

    const activeSegments = React.useMemo(() => data.filter((s) => s.value > 0), [data]);
    const hasMultiSegments = activeSegments.length > 1;

    // Leave extra breathing room in radius so hovered strokeWidth growth never clips
    const maxStrokeWidth = strokeWidth + 3;
    const radius = size / 2 - maxStrokeWidth / 2 - 2;
    const circumference = 2 * Math.PI * radius;
    // strokeLinecap="round" extends strokeWidth/2 past each end, so subtract strokeWidth + segmentGap
    const effectiveTrim = hasMultiSegments
      ? Math.min(strokeWidth + segmentGap, (circumference / activeSegments.length) * 0.72)
      : 0;

    React.useEffect(() => {
      onSegmentHoverRef.current?.(hoveredSegment);
    }, [hoveredSegment]);

    const activeLabel = hoveredLabel !== undefined ? hoveredLabel : (hoveredSegment?.label ?? null);
    const hasActiveHighlight = highlightOnHover && activeLabel !== null;

    let cumulativeLength = 0;

    return (
      <div
        ref={ref}
        className={cn('relative flex items-center justify-center', className)}
        style={{ width: size, height: size }}
        onMouseLeave={() => setHoveredSegment(null)}
        {...props}
      >
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          className="overflow-visible -rotate-90"
          role="img"
          aria-label={props['aria-label'] ?? 'Donut breakdown chart'}
        >
          {/* Base background track ring */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="transparent"
            stroke={trackColor}
            strokeWidth={strokeWidth}
          />

          {/* Subtle inner hairline guide ring */}
          {showInnerRing && radius - strokeWidth * 0.78 > 14 && (
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius - strokeWidth * 0.78}
              fill="transparent"
              stroke="var(--border)"
              strokeWidth={1}
              strokeDasharray="2 4"
            />
          )}

          {/* Data Segments */}
          <AnimatePresence>
            {data.map((segment, index) => {
              if (segment.value <= 0) return null;

              const ratio =
                internalTotalValue === 0
                  ? 0
                  : Math.min(1, Math.max(0, segment.value / internalTotalValue));
              const rawArcLength = ratio * circumference;
              const drawnArcLength = hasMultiSegments
                ? Math.max(0.5, rawArcLength - effectiveTrim)
                : rawArcLength;

              const slotTrim = rawArcLength - drawnArcLength;
              const startOffset = cumulativeLength + slotTrim / 2;
              cumulativeLength += rawArcLength;

              const isActive = hasActiveHighlight && activeLabel === segment.label;
              const isDimmed = hasActiveHighlight && !isActive;

              const strokeDasharray = `${drawnArcLength} ${circumference}`;
              const targetOpacity = isDimmed ? 0.3 : 1;

              return (
                <motion.circle
                  key={segment.label || index}
                  cx={size / 2}
                  cy={size / 2}
                  r={radius}
                  fill="transparent"
                  stroke={segment.color}
                  strokeWidth={isActive ? strokeWidth + 3 : strokeWidth}
                  strokeDasharray={strokeDasharray}
                  strokeLinecap="round"
                  initial={
                    prefersReducedMotion
                      ? false
                      : { opacity: 0, strokeDashoffset: -(startOffset - drawnArcLength * 0.35) }
                  }
                  animate={{
                    opacity: targetOpacity,
                    strokeDashoffset: -startOffset,
                  }}
                  transition={
                    prefersReducedMotion
                      ? { duration: 0 }
                      : {
                          opacity: { duration: 0.22, delay: index * animationDelayPerSegment },
                          strokeDashoffset: {
                            duration: animationDuration,
                            delay: index * animationDelayPerSegment,
                            ease: 'easeOut',
                          },
                        }
                  }
                  tabIndex={highlightOnHover ? 0 : undefined}
                  aria-label={highlightOnHover ? `${segment.label}: ${segment.value}` : undefined}
                  className={cn('outline-none', highlightOnHover && 'cursor-pointer')}
                  style={{
                    transition: prefersReducedMotion
                      ? 'none'
                      : 'stroke-width 0.2s ease-out, opacity 0.2s ease-out',
                  }}
                  onMouseEnter={highlightOnHover ? () => setHoveredSegment(segment) : undefined}
                  onFocus={highlightOnHover ? () => setHoveredSegment(segment) : undefined}
                  onBlur={highlightOnHover ? () => setHoveredSegment(null) : undefined}
                />
              );
            })}
          </AnimatePresence>
        </svg>

        {/* Center Content */}
        {centerContent && (
          <div
            className="absolute flex flex-col items-center justify-center pointer-events-none px-1"
            style={{
              width: Math.max(0, radius * 2 - strokeWidth - 6),
              height: Math.max(0, radius * 2 - strokeWidth - 6),
            }}
          >
            {centerContent}
          </div>
        )}
      </div>
    );
  },
);

DonutChart.displayName = 'DonutChart';

export { DonutChart };
