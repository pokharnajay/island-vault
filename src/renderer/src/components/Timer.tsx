import ProgressRing from './ProgressRing'
import { fmtClock, type Timer as TimerModel } from '../hooks/useTimer'

const COLOR: Record<'focus' | 'break', string> = { focus: '#ff453a', break: '#30d158' }

export default function Timer({ timer }: { timer: TimerModel }) {
  const color = COLOR[timer.mode]
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

      <ProgressRing fraction={timer.fraction} size={108} stroke={8} color={color}>
        <div className="timerClock" style={{ color }}>
          {fmtClock(timer.remainingMs)}
        </div>
      </ProgressRing>

      <div className="timerActions">
        <button className="ctrlBtn" onClick={timer.reset} title="Reset">
          ↺
        </button>
        <button className="ctrlBtn primary" onClick={timer.toggle}>
          {timer.running ? 'Pause' : 'Start'}
        </button>
      </div>
    </div>
  )
}
