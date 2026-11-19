import { formatTime } from '../lib/format'
import type { TimerStatus } from '../hooks/usePhaseTimer'
import type { Phase } from '../types'
import {
  GearIcon,
  PauseIcon,
  PlayIcon,
  ResetIcon,
  TimerMiniIcon,
} from './Icons'

interface RoundsScreenProps {
  status: TimerStatus
  currentPhase: Phase | null
  nextPhase: Phase | null
  phaseRemaining: number
  totalRemaining: number
  roundsLeft: number
  currentRoundNumber: number
  idlePrepare: number
  idleRoundDuration: number
  idleRestDuration: number
  totalRounds: number
  onOpenSettings: (focusKey?: string) => void
  onToggle: () => void
  onReset: () => void
}

export function RoundsScreen({
  status,
  currentPhase,
  nextPhase,
  phaseRemaining,
  totalRemaining,
  roundsLeft,
  currentRoundNumber,
  idlePrepare,
  idleRoundDuration,
  idleRestDuration,
  totalRounds,
  onOpenSettings,
  onToggle,
  onReset,
}: RoundsScreenProps) {
  const canConfigure = status === 'idle' || status === 'finished'

  const primary =
    status === 'idle'
      ? {
          label: 'PREPARAR',
          time: formatTime(idlePrepare),
          color: '#f5e600',
          focusKey: 'prepare',
        }
      : {
          label: currentPhase?.label ?? 'RONDA',
          time: formatTime(phaseRemaining),
          color: currentPhase?.color ?? '#f5e600',
          focusKey:
            currentPhase?.kind === 'prepare'
              ? 'prepare'
              : currentPhase?.kind === 'rest'
                ? 'rest'
                : 'round',
        }

  const secondary =
    status === 'idle'
      ? {
          label: 'RONDA 1',
          time: formatTime(idleRoundDuration),
          color: '#9dff4a',
          focusKey: 'round',
        }
      : nextPhase
        ? {
            label: nextPhase.label,
            time: formatTime(nextPhase.duration),
            color: nextPhase.color,
            focusKey:
              nextPhase.kind === 'prepare'
                ? 'prepare'
                : nextPhase.kind === 'rest'
                  ? 'rest'
                  : 'round',
          }
        : {
            label: 'FIM',
            time: '00:00',
            color: '#333333',
            focusKey: 'round',
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
          onClick={() => onOpenSettings()}
          aria-label="Configurações"
        >
          <GearIcon />
        </button>

        <div className="header-center">
          <h1>RONDAS</h1>
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
          CONFIGURAR RONDAS · {totalRounds}× {formatTime(idleRoundDuration)} · descanso{' '}
          {formatTime(idleRestDuration)}
        </button>
      ) : null}

      <div className="phase-stack">
        <button
          type="button"
          className="phase-block phase-primary"
          style={{ background: primary.color }}
          disabled={!canConfigure}
          onClick={() => onOpenSettings(primary.focusKey)}
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
          onClick={() => onOpenSettings(secondary.focusKey)}
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
          aria-label="Configurar número de rondas"
        >
          <p className="stat-value stat-blue">{canConfigure ? totalRounds : roundsLeft}</p>
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

        <div className="stat-block">
          <p className="stat-value stat-yellow">{currentRoundNumber}</p>
          <p className="stat-label">RONDA ATUAL</p>
        </div>
      </div>
    </section>
  )
}
