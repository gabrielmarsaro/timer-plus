import type { Tab } from '../types'
import {
  MoreNavIcon,
  RoundsNavIcon,
  StopwatchNavIcon,
  TabataNavIcon,
} from './Icons'

interface BottomNavProps {
  active: Tab
  onChange: (tab: Tab) => void
}

const ITEMS: Array<{ id: Tab; label: string; Icon: typeof TabataNavIcon }> = [
  { id: 'tabata', label: 'TABATA', Icon: TabataNavIcon },
  { id: 'rounds', label: 'RONDAS', Icon: RoundsNavIcon },
  { id: 'stopwatch', label: 'CRONÓMETRO', Icon: StopwatchNavIcon },
  { id: 'more', label: 'MAIS', Icon: MoreNavIcon },
]

export function BottomNav({ active, onChange }: BottomNavProps) {
  return (
    <nav className="bottom-nav" aria-label="Navegação principal">
      {ITEMS.map(({ id, label, Icon }) => {
        const isActive = active === id
        return (
          <button
            key={id}
            type="button"
            className={`nav-item${isActive ? ' is-active' : ''}`}
            onClick={() => onChange(id)}
            aria-current={isActive ? 'page' : undefined}
          >
            <span className="nav-icon-wrap">
              <Icon className="nav-icon" />
            </span>
            <span className="nav-label">{label}</span>
          </button>
        )
      })}
    </nav>
  )
}
