interface Props {
  fraction: number // 0..1 filled
  size: number
  stroke: number
  color?: string
  track?: string
  children?: React.ReactNode
}

// SVG progress ring used both big (Timer panel) and tiny (collapsed pill).
export default function ProgressRing({
  fraction,
  size,
  stroke,
  color = '#ff453a',
  track = 'rgba(255,255,255,0.12)',
  children
}: Props) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const dash = Math.max(0, Math.min(1, fraction)) * c
  return (
    <div className="ring" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="ringSvg">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${c}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      {children != null && <div className="ringInner">{children}</div>}
    </div>
  )
}
