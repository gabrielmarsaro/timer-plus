interface PhaseView {
  label: string
  time: string
  color: string
  key?: string
}

interface PhaseHeroProps {
  /** Current phase alone, center stage (work / rest / …). */
  focus: boolean
  primary: PhaseView
  secondary: PhaseView
  /** Remaining fraction of the current phase (0–1). */
  progress?: number
  /** Last seconds of a phase — visual urgency. */
  urgency?: boolean
}

/** Preview stack vs star-of-the-show focus for the active phase. */
export function PhaseHero({
  focus,
  primary,
  secondary,
  progress = 1,
  urgency = false,
}: PhaseHeroProps) {
  const pct = Math.round(Math.max(0, Math.min(1, progress)) * 100)

  return (
    <div
      className={`phase-stack${focus ? ' is-focus' : ''}${urgency ? ' is-urgent' : ''}`}
      style={{ ['--phase-color' as string]: primary.color }}
    >
      <div
        key={focus ? (primary.key ?? primary.label) : 'preview-primary'}
        className={`phase-block phase-primary phase-card${focus ? ' is-star' : ''}`}
        style={{ background: primary.color }}
      >
        <p className="phase-label">{primary.label}</p>
        <p className={`phase-time ${focus ? 'phase-time-hero' : 'phase-time-lg'}`}>
          {primary.time}
        </p>
        {focus ? (
          <div
            className="phase-progress-bar"
            role="progressbar"
            aria-valuenow={pct}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Progresso da fase"
          >
            <span style={{ width: `${pct}%` }} />
          </div>
        ) : null}
      </div>

      {!focus ? (
        <div
          className="phase-block phase-secondary phase-card"
          style={{ background: secondary.color }}
        >
          <p className="phase-label">{secondary.label}</p>
          <p className="phase-time phase-time-md">{secondary.time}</p>
        </div>
      ) : null}
    </div>
  )
}

export function isPhaseFocusKind(kind: string | undefined): boolean {
  return kind === 'work' || kind === 'rest' || kind === 'cycleRest' || kind === 'cooldown'
}
