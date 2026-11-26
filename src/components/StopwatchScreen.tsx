import { formatStopwatch } from '../lib/format'
import type { Lap, StopwatchStatus } from '../hooks/useStopwatch'
import { ForgeMark, GearIcon, PauseIcon, PlayIcon, ResetIcon } from './Icons'
import { PlayControl } from './PlayControl'

interface StopwatchScreenProps {
  status: StopwatchStatus
  elapsedMs: number
  laps: Lap[]
  onOpenGeneralSettings: () => void
  onToggle: () => void
  onLap: () => void
  onReset: () => void
}

export function StopwatchScreen({
  status,
  elapsedMs,
  laps,
  onOpenGeneralSettings,
  onToggle,
  onLap,
  onReset,
}: StopwatchScreenProps) {
  const isRunning = status === 'running'
  const isLive = status !== 'idle'
  const actionLabel =
    status === 'running' ? 'PAUSAR' : status === 'paused' ? 'CONTINUAR' : 'INICIAR'
  const canLap = status === 'running'
  const canReset = status !== 'idle'

  const bestLap =
    laps.length > 0 ? Math.min(...laps.map((lap) => lap.lapMs)) : null
  const worstLap =
    laps.length > 0 ? Math.max(...laps.map((lap) => lap.lapMs)) : null

  return (
    <section className={`stopwatch-screen${isLive ? ' is-live' : ''}`}>
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
          <h1>CRONÓMETRO</h1>
          <p className="total-time stopwatch-subtitle">
            {laps.length > 0 ? `${laps.length} VOLTA${laps.length === 1 ? '' : 'S'}` : 'VOLTAS'}
          </p>
        </div>
        <div className="header-right">
          <button
            type="button"
            className="reset-btn"
            onClick={onReset}
            aria-label="Reiniciar"
            disabled={!canReset}
          >
            <ResetIcon />
          </button>
        </div>
      </header>

      <div className="stopwatch-stage">
        <p className="stopwatch-time" aria-live="off">
          {formatStopwatch(elapsedMs)}
        </p>
        {laps[0] ? (
          <p className="stopwatch-last-lap">
            ÚLTIMA VOLTA {formatStopwatch(laps[0].lapMs)}
          </p>
        ) : (
          <p className="stopwatch-last-lap is-muted">TOQUE EM VOLTA PARA MARCAR INTERVALOS</p>
        )}
      </div>

      <div className="controls-row stopwatch-controls">
        <div className="stat-block">
          <button
            type="button"
            className={`secondary-action-btn${canLap ? '' : ' is-disabled'}`}
            onClick={onLap}
            disabled={!canLap}
            aria-label="Volta"
          >
            VOLTA
          </button>
        </div>

        <PlayControl
          label={actionLabel}
          running={isRunning}
          progress={1}
          ringColor="var(--accent)"
          onClick={onToggle}
        >
          {isRunning ? <PauseIcon /> : <PlayIcon className="play-glyph" />}
        </PlayControl>

        <div className="stat-block">
          <button
            type="button"
            className={`secondary-action-btn${canReset ? '' : ' is-disabled'}`}
            onClick={onReset}
            disabled={!canReset}
            aria-label="Zerar"
          >
            ZERAR
          </button>
        </div>
      </div>

      <div className="lap-list" role="list" aria-label="Voltas">
        {laps.length === 0 ? (
          <p className="lap-empty">As voltas aparecem aqui.</p>
        ) : (
          laps.map((lap) => {
            const isBest = bestLap !== null && lap.lapMs === bestLap && laps.length > 1
            const isWorst = worstLap !== null && lap.lapMs === worstLap && laps.length > 1
            return (
              <div
                key={`${lap.index}-${lap.totalMs}`}
                className={`lap-row${isBest ? ' is-best' : ''}${isWorst ? ' is-worst' : ''}`}
                role="listitem"
              >
                <span className="lap-index">VOLTA {lap.index}</span>
                <span className="lap-split">{formatStopwatch(lap.lapMs)}</span>
                <span className="lap-total">{formatStopwatch(lap.totalMs)}</span>
              </div>
            )
          })
        )}
      </div>
    </section>
  )
}
