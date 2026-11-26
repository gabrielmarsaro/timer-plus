import type { ReactNode } from 'react'

interface PlayControlProps {
  label: string
  running: boolean
  /** Fraction of phase still remaining (0–1). Idle = full ring. */
  progress: number
  ringColor: string
  onClick: () => void
  children: ReactNode
}

const R = 44
const C = 2 * Math.PI * R

/** Botão INICIAR/PAUSAR com anel de progresso da fase. */
export function PlayControl({
  label,
  running,
  progress,
  ringColor,
  onClick,
  children,
}: PlayControlProps) {
  const clamped = Math.max(0, Math.min(1, progress))
  const dash = C * clamped
  const urgent = running && clamped > 0 && clamped <= 0.15

  return (
    <div className={`play-block${urgent ? ' is-urgent' : ''}${running ? ' is-running' : ''}`}>
      <button
        type="button"
        className="play-btn"
        onClick={onClick}
        aria-label={label}
      >
        <svg
          className="play-ring"
          viewBox="0 0 100 100"
          aria-hidden
        >
          <circle className="play-ring-track" cx="50" cy="50" r={R} />
          <circle
            className="play-ring-value"
            cx="50"
            cy="50"
            r={R}
            style={{
              stroke: ringColor,
              strokeDasharray: `${dash} ${C}`,
            }}
          />
        </svg>
        <span className="play-btn-face">{children}</span>
      </button>
      <p className="play-label">{label}</p>
    </div>
  )
}
