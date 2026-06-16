import { useEffect, useState } from 'react'
import ProgressRing from './ProgressRing'
import { fmtClock, type Timer as TimerModel } from '../hooks/useTimer'

const COLOR: Record<'focus' | 'break', string> = { focus: '#ff453a', break: '#30d158' }

function clampField(v: number): number {
  return Math.max(0, Math.min(60, v))
}

function Stepper({
  value,
  onDelta,
  color
}: {
  value: number
  onDelta: (d: number) => void
  color: string
}) {
  return (
    <div className="stepper" onWheel={(e) => onDelta(e.deltaY < 0 ? 1 : -1)}>
      <button className="stepBtn" onClick={() => onDelta(1)} tabIndex={-1}>
        ▲
      </button>
      <span className="stepVal" style={{ color }}>
        {String(value).padStart(2, '0')}
      </span>
      <button className="stepBtn" onClick={() => onDelta(-1)} tabIndex={-1}>
        ▼
      </button>
    </div>
  )
}

export default function Timer({ timer }: { timer: TimerModel }) {
  const [editing, setEditing] = useState(false)
  const color = COLOR[timer.mode]

  // A running timer can never be in edit mode.
  useEffect(() => {
    if (timer.running) setEditing(false)
  }, [timer.running])

  const min = Math.floor(timer.durationMs / 60000)
  const sec = Math.floor((timer.durationMs % 60000) / 1000)
  const apply = (m: number, s: number): void =>
    timer.setDuration(timer.mode, clampField(m) * 60000 + clampField(s) * 1000)

  return (
    <div className="timer">
      <div className="timerModes">
        <button
          className={`segBtn ${timer.mode === 'focus' ? 'on' : ''}`}
          onClick={() => timer.switchMode('focus')}
        >
          Focus
        </button>
        <button
          className={`segBtn ${timer.mode === 'break' ? 'on' : ''}`}
          onClick={() => timer.switchMode('break')}
        >
          Break
        </button>
      </div>

      <ProgressRing fraction={editing ? 0 : timer.fraction} size={104} stroke={8} color={color}>
        {editing ? (
          <div className="durEdit">
            <Stepper value={min} onDelta={(d) => apply(min + d, sec)} color={color} />
            <span className="durColon">:</span>
            <Stepper value={sec} onDelta={(d) => apply(min, sec + d)} color={color} />
          </div>
        ) : (
          <div
            className="timerClock"
            style={{ color, cursor: timer.running ? 'default' : 'pointer' }}
            title={timer.running ? undefined : 'Click to set duration'}
            onClick={() => {
              if (!timer.running) setEditing(true)
            }}
          >
            {fmtClock(timer.remainingMs)}
          </div>
        )}
      </ProgressRing>

      <div className="timerActions">
        <button className="ctrlBtn" onClick={timer.reset} title="Reset">
          ↺
        </button>
        <button
          className="ctrlBtn primary"
          onClick={() => (editing ? setEditing(false) : timer.toggle())}
        >
          {editing ? 'Done' : timer.running ? 'Pause' : 'Start'}
        </button>
      </div>
    </div>
  )
}
