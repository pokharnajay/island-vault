export type HubTab = 'clipboard' | 'timer'

interface Props {
  tab: HubTab
  onChange: (t: HubTab) => void
  clipCount: number
  timerRunning: boolean
}

const TABS: { key: HubTab; label: string; glyph: string }[] = [
  { key: 'clipboard', label: 'Clips', glyph: '▤' },
  { key: 'timer', label: 'Timer', glyph: '◷' }
]

export default function TabBar({ tab, onChange, clipCount, timerRunning }: Props) {
  return (
    <div className="tabBar">
      {TABS.map((t) => (
        <button
          key={t.key}
          className={`tab ${tab === t.key ? 'on' : ''}`}
          onClick={() => onChange(t.key)}
        >
          <span className="tabGlyph">{t.glyph}</span>
          <span className="tabLabel">{t.label}</span>
          {t.key === 'clipboard' && clipCount > 0 && <span className="tabCount">{clipCount}</span>}
          {t.key === 'timer' && timerRunning && <span className="tabDot" />}
        </button>
      ))}
    </div>
  )
}
