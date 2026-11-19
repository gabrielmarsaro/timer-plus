import { formatTime, type TimeFormat } from '../lib/format'
import type { TimerStatus } from '../hooks/usePhaseTimer'
import type { Phase } from '../types'
import {
  GearIcon,
  PauseIcon,
  PlayIcon,
  ResetIcon,
  TimerMiniIcon,
} from './Icons'

interface TabataScreenProps {
  status: TimerStatus
  currentPhase: Phase | null
  nextPhase: Phase | null
  phaseRemaining: number
  totalRemaining: number
  roundsLeft: number
  cyclesLeft: number
  idleWorkDuration: number
  timeFormat: TimeFormat
  onOpenGeneralSettings: () => void
  onOpenWorkoutEdit: () => void
  onToggle: () => void
  onReset: () => void
}

export function TabataScreen({
  status,
  currentPhase,
  nextPhase,
  phaseRemaining,
  totalRemaining,
  roundsLeft,
  cyclesLeft,
  idleWorkDuration,
  timeFormat,
  onOpenGeneralSettings,
  onOpenWorkoutEdit,
  onToggle,
  onReset,
}: TabataScreenProps) {
  const primary =
    status === 'idle'
      ? {
          label: 'PREPARAR',
          time: formatTime(phaseRemaining, timeFormat),
          color: '#f5e600',
        }
      : {
          label: currentPhase?.label ?? 'PREPARAR',
          time: formatTime(phaseRemaining, timeFormat),
          color: currentPhase?.color ?? '#f5e600',
        }

  const secondary =
    status === 'idle'
      ? {
          label: 'EXERCÍCIO',
          time: formatTime(idleWorkDuration, timeFormat),
          color: '#9dff4a',
        }
      : nextPhase
        ? {
            label: nextPhase.label,
            time: formatTime(nextPhase.duration, timeFormat),
            color: nextPhase.color,
          }
        : {
            label: 'FIM',
            time: formatTime(0, timeFormat),
            color: '#333333',
          }

  const isRunning = status === 'running'
  const actionLabel =
    status === 'running' ? 'PAUSAR' : status === 'paused' ? 'CONTINUAR' : 'INICIAR'

  return (
    <section className="tabata-screen">
      <header className="tabata-header">
        <button
          type="button"
          className="icon-btn"
          onClick={onOpenGeneralSettings}
          aria-label="Configurações"
        >
          <GearIcon />
        </button>

        <div className="header-center">
          <h1>TABATA</h1>
          <p className="total-time">{formatTime(totalRemaining, timeFormat)}</p>
        </div>

        <div className="header-right">
          <button
            type="button"
            className="icon-btn timer-edit-btn"
            onClick={onOpenWorkoutEdit}
            aria-label="Editar Tabata"
            title="Editar tempos do Tabata"
          >
            <TimerMiniIcon />
          </button>
          <button
            type="button"
            className="reset-btn"
            onClick={onReset}
            aria-label="Reiniciar"
          >
            <ResetIcon />
          </button>
        </div>
      </header>

      <div className="phase-stack">
        <div className="phase-block phase-primary" style={{ background: primary.color }}>
          <p className="phase-label">{primary.label}</p>
          <p className="phase-time phase-time-lg">{primary.time}</p>
        </div>

        <div className="phase-block phase-secondary" style={{ background: secondary.color }}>
          <p className="phase-label">{secondary.label}</p>
          <p className="phase-time phase-time-md">{secondary.time}</p>
        </div>
      </div>

      <div className="controls-row">
        <div className="stat-block">
          <p className="stat-value stat-blue">{roundsLeft}</p>
          <p className="stat-label">RONDAS PARA TERMINAR</p>
        </div>

        <div className="play-block">
          <button
            type="button"
            className="play-btn"
            onClick={onToggle}
            aria-label={actionLabel}
          >
            {isRunning ? <PauseIcon /> : <PlayIcon />}
          </button>
          <p className="play-label">{actionLabel}</p>
        </div>

        <div className="stat-block">
          <p className="stat-value stat-yellow">{cyclesLeft}</p>
          <p className="stat-label">CICLOS PARA TERMINAR</p>
        </div>
      </div>
    </section>
  )
}
