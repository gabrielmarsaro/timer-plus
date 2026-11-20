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
}

/** Preview stack vs star-of-the-show focus for the active phase. */
export function PhaseHero({ focus, primary, secondary }: PhaseHeroProps) {
  return (
    <div className={`phase-stack${focus ? ' is-focus' : ''}`}>
      <div
        key={focus ? (primary.key ?? primary.label) : 'preview-primary'}
        className={`phase-block phase-primary${focus ? ' is-star' : ''}`}
        style={{ background: primary.color }}
      >
        <p className="phase-label">{primary.label}</p>
        <p className={`phase-time ${focus ? 'phase-time-hero' : 'phase-time-lg'}`}>
          {primary.time}
        </p>
      </div>

      {!focus ? (
        <div
          className="phase-block phase-secondary"
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
