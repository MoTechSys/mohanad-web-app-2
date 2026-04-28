import { useMemo } from 'react';

/**
 * Sparkline — dependency-free SVG mini-chart.
 *
 * Plots an area + line through the supplied numeric series.
 * Designed for dashboard StatCards (height ~32 px).
 */
export interface SparklineProps {
  data: number[];
  width?: number;
  height?: number;
  /** Stroke colour — defaults to the Emerald primary. */
  color?: string;
  /** Fill (gradient) colour with low alpha. */
  fill?: string;
  className?: string;
}

export function Sparkline({
  data,
  width = 120,
  height = 36,
  color = '#059669',
  fill = 'rgba(5,150,105,0.18)',
  className,
}: SparklineProps): JSX.Element {
  const { linePath, areaPath } = useMemo(() => {
    if (data.length === 0) {
      return { linePath: '', areaPath: '' };
    }
    const min = Math.min(...data);
    const max = Math.max(...data);
    const span = max - min || 1;
    const stepX = data.length === 1 ? 0 : width / (data.length - 1);

    const points = data.map((v, i) => {
      const x = i * stepX;
      const y = height - ((v - min) / span) * (height - 2) - 1;
      return [x, y] as const;
    });

    const line = points
      .map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`)
      .join(' ');
    const area = `${line} L${width},${height} L0,${height} Z`;
    return { linePath: line, areaPath: area };
  }, [data, height, width]);

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label="رسم بياني مصغر"
      className={className}
    >
      <path d={areaPath} fill={fill} />
      <path
        d={linePath}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
