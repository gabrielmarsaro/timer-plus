import { formatTime, type TimeFormat } from '../lib/format'
import type { TimerStatus } from '../hooks/usePhaseTimer'
import { PHASE_COLORS } from '../types'
import type { Phase } from '../types'
import {
  ForgeMark,
  GearIcon,
  PauseIcon,
  PlayIcon,
  ResetIcon,
  SkipIcon,
  TimerMiniIcon,
} from './Icons'
import { isPhaseFocusKind, PhaseHero } from './PhaseHero'
import { PlayControl } from './PlayControl'

interface TabataScreenProps {
  status: TimerStatus
  currentPhase: Phase | null
  nextPhase: Phase | null
  phaseRemaining: number
  totalRemaining: number
  roundsLeft: number
  cyclesLeft: number
  currentRoundNumber: number
  totalRounds: number
  idleWorkDuration: number
  timeFormat: TimeFormat
  onOpenGeneralSettings: () => void
  onOpenWorkoutEdit: () => void
  onToggle: () => void
  onReset: () => void
  onSkip: () => void
  onExtend: () => void
}

export function TabataScreen({
  status,
  currentPhase,
  nextPhase,
  phaseRemaining,
  totalRemaining,
  roundsLeft,
  cyclesLeft,
  currentRoundNumber,
  totalRounds,
  idleWorkDuration,
  timeFormat,
  onOpenGeneralSettings,
  onOpenWorkoutEdit,
  onToggle,
  onReset,
  onSkip,
  onExtend,
}: TabataScreenProps) {
  const isLive = status === 'running' || status === 'paused'
  const focus = isLive && isPhaseFocusKind(currentPhase?.kind)
  const phaseDuration =
    status === 'idle'
      ? Math.max(phaseRemaining, 1)
      : Math.max(currentPhase?.duration ?? phaseRemaining, 1)
  const progress = Math.max(0, Math.min(1, phaseRemaining / phaseDuration))
  const urgency = isLive && phaseRemaining > 0 && phaseRemaining <= 3
  const phaseColor = currentPhase?.color ?? PHASE_COLORS.prepare

  const primary =
    status === 'idle'
      ? {
          label: 'PREPARAR',
          time: formatTime(phaseRemaining, timeFormat),
          color: PHASE_COLORS.prepare,
          key: 'idle-prepare',
        }
      : {
          label: currentPhase?.label ?? 'PREPARAR',
          time: formatTime(phaseRemaining, timeFormat),
          color: phaseColor,
          key: [
            currentPhase?.kind ?? 'prepare',
            currentPhase?.round ?? 0,
            currentPhase?.cycle ?? 0,
          ].join('-'),
        }

  const secondary =
    status === 'idle'
      ? {
          label: 'EXERCÍCIO',
          time: formatTime(idleWorkDuration, timeFormat),
          color: PHASE_COLORS.work,
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
            color: PHASE_COLORS.done,
          }

  const isRunning = status === 'running'
  const actionLabel =
    status === 'running' ? 'PAUSAR' : status === 'paused' ? 'CONTINUAR' : 'INICIAR'

  return (
    <section
      className={`tabata-screen${focus ? ' is-live' : ''}${urgency ? ' is-urgent' : ''}`}
      style={{ ['--phase-color' as string]: primary.color }}
    >
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
          <p className="brand-mark header-brand">
            <ForgeMark className="brand-rune" />
            TIMER VIKING
          </p>
          <h1>TABATA</h1>
          <p className="total-time">{formatTime(totalRemaining, timeFormat)}</p>
          {isLive ? (
            <p className="progress-chip">
              RONDA {currentRoundNumber}/{totalRounds}
            </p>
          ) : null}
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

      <PhaseHero
        focus={focus}
        primary={primary}
        secondary={secondary}
        progress={progress}
        urgency={urgency}
      />

      {isLive ? (
        <div className="workout-adjust" role="group" aria-label="Ajustes do treino">
          <button type="button" className="adjust-btn" onClick={onExtend}>
            +15s
          </button>
          <button type="button" className="adjust-btn" onClick={onSkip}>
            <SkipIcon />
            PULAR
          </button>
        </div>
      ) : null}

      <div className={`controls-row${focus ? ' is-live' : ''}`}>
        <div className="stat-block">
          <p className="stat-value stat-blue">{roundsLeft}</p>
          <p className="stat-label">RONDAS PARA TERMINAR</p>
        </div>

        <PlayControl
          label={actionLabel}
          running={isRunning}
          progress={isLive ? progress : 1}
          ringColor={isLive ? phaseColor : 'rgba(255,255,255,0.18)'}
          onClick={onToggle}
        >
          {isRunning ? <PauseIcon /> : <PlayIcon className="play-glyph" />}
        </PlayControl>

        {focus ? (
          <div className="stat-block">
            <button
              type="button"
              className="live-reset-btn"
              onClick={onReset}
              aria-label="Reiniciar"
            >
              <ResetIcon />
            </button>
            <p className="stat-label">REINICIAR</p>
          </div>
        ) : (
          <div className="stat-block">
            <p className="stat-value stat-yellow">{cyclesLeft}</p>
            <p className="stat-label">CICLOS PARA TERMINAR</p>
          </div>
        )}
      </div>
    </section>
  )
}
