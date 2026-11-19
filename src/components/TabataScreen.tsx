import { formatTime } from '../lib/format'
import type { Phase } from '../types'
import type { TimerStatus } from '../hooks/usePhaseTimer'
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
  onOpenSettings: (focusKey?: string) => void
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
  onOpenSettings,
  onToggle,
  onReset,
}: TabataScreenProps) {
  const primary =
    status === 'idle'
      ? {
          label: 'PREPARAR',
          time: formatTime(phaseRemaining),
          color: '#f5e600',
        }
      : {
          label: currentPhase?.label ?? 'PREPARAR',
          time: formatTime(phaseRemaining),
          color: currentPhase?.color ?? '#f5e600',
        }

  const secondary =
    status === 'idle'
      ? {
          label: 'EXERCÍCIO',
          time: formatTime(idleWorkDuration),
          color: '#9dff4a',
        }
      : nextPhase
        ? {
            label: nextPhase.label,
            time: formatTime(nextPhase.duration),
            color: nextPhase.color,
          }
        : {
            label: 'FIM',
            time: '00:00',
            color: '#333333',
          }

  const isRunning = status === 'running'
  const canConfigure = status === 'idle' || status === 'finished'
  const actionLabel =
    status === 'running' ? 'PAUSAR' : status === 'paused' ? 'CONTINUAR' : 'INICIAR'

  return (
    <section className="tabata-screen">
      <header className="tabata-header">
        <button
          type="button"
          className="icon-btn"
          onClick={() => onOpenSettings()}
          aria-label="Configurações"
        >
          <GearIcon />
        </button>

        <div className="header-center">
          <h1>TABATA</h1>
          <p className="total-time">{formatTime(totalRemaining)}</p>
        </div>

        <div className="header-right">
          <TimerMiniIcon className="header-mini-icon" />
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

      {canConfigure ? (
        <button
          type="button"
          className="configure-banner"
          onClick={() => onOpenSettings()}
        >
          CONFIGURAR TABATA · toque aqui ou na engrenagem
        </button>
      ) : null}

      <div className="phase-stack">
        <button
          type="button"
          className="phase-block phase-primary"
          style={{ background: primary.color }}
          disabled={!canConfigure}
          onClick={() => onOpenSettings('prepare')}
        >
          <p className="phase-label">{primary.label}</p>
          <p className="phase-time phase-time-lg">{primary.time}</p>
          {canConfigure ? <span className="phase-edit-hint">TOQUE PARA EDITAR</span> : null}
        </button>

        <button
          type="button"
          className="phase-block phase-secondary"
          style={{ background: secondary.color }}
          disabled={!canConfigure}
          onClick={() => onOpenSettings('work')}
        >
          <p className="phase-label">{secondary.label}</p>
          <p className="phase-time phase-time-md">{secondary.time}</p>
          {canConfigure ? <span className="phase-edit-hint">TOQUE PARA EDITAR</span> : null}
        </button>
      </div>

      <div className="controls-row">
        <button
          type="button"
          className="stat-block stat-btn"
          disabled={!canConfigure}
          onClick={() => onOpenSettings('rounds')}
        >
          <p className="stat-value stat-blue">{roundsLeft}</p>
          <p className="stat-label">
            {canConfigure ? 'RONDAS (TOQUE)' : 'RONDAS PARA TERMINAR'}
          </p>
        </button>

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

        <button
          type="button"
          className="stat-block stat-btn"
          disabled={!canConfigure}
          onClick={() => onOpenSettings('cycles')}
        >
          <p className="stat-value stat-yellow">{cyclesLeft}</p>
          <p className="stat-label">
            {canConfigure ? 'CICLOS (TOQUE)' : 'CICLOS PARA TERMINAR'}
          </p>
        </button>
      </div>
    </section>
  )
}
