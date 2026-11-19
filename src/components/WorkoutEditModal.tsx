import { useEffect, useState } from 'react'
import type { RoundsSettings, TabataSettings } from '../types'

type Mode = 'tabata' | 'rounds'
type AnySettings = TabataSettings | RoundsSettings

interface FieldDef {
  key: string
  label: string
  min: number
  max: number
  step: number
  count?: boolean
}

const TABATA_FIELDS: FieldDef[] = [
  { key: 'prepare', label: 'PREPARAR', min: 0, max: 600, step: 5 },
  { key: 'work', label: 'EXERCÍCIO', min: 1, max: 3600, step: 5 },
  { key: 'rest', label: 'DESCANSO', min: 0, max: 600, step: 5 },
  { key: 'rounds', label: 'RONDAS', min: 1, max: 99, step: 1, count: true },
  { key: 'cycles', label: 'CICLOS', min: 1, max: 20, step: 1, count: true },
  { key: 'cycleRest', label: 'DESCANSO ENTRE CICLOS', min: 0, max: 600, step: 5 },
  { key: 'cooldown', label: 'COOLDOWN', min: 0, max: 600, step: 5 },
]

const ROUNDS_FIELDS: FieldDef[] = [
  { key: 'prepare', label: 'PREPARAR', min: 0, max: 600, step: 5 },
  { key: 'round', label: 'EXERCÍCIO', min: 5, max: 900, step: 1 },
  { key: 'rest', label: 'DESCANSO', min: 0, max: 600, step: 5 },
  { key: 'rounds', label: 'RONDAS', min: 1, max: 99, step: 1, count: true },
  { key: 'warning', label: 'AVISO FINAL', min: 0, max: 60, step: 5 },
]

interface WorkoutEditModalProps {
  open: boolean
  mode: Mode
  settings: AnySettings
  onClose: () => void
  onSave: (settings: AnySettings) => void
}

function formatValue(value: number, count?: boolean): string {
  if (count) return String(value)
  const mins = Math.floor(value / 60)
  const secs = value % 60
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

export function WorkoutEditModal({
  open,
  mode,
  settings,
  onClose,
  onSave,
}: WorkoutEditModalProps) {
  const [draft, setDraft] = useState(settings)
  const fields = mode === 'tabata' ? TABATA_FIELDS : ROUNDS_FIELDS

  useEffect(() => {
    if (open) setDraft(settings)
  }, [open, settings])

  if (!open) return null

  const bump = (key: string, delta: number, min: number, max: number) => {
    setDraft((prev) => {
      const current = Number((prev as unknown as Record<string, number>)[key] ?? 0)
      return { ...prev, [key]: clamp(current + delta, min, max) }
    })
  }

  const finish = () => {
    onSave(draft)
    onClose()
  }

  return (
    <div className="native-sheet" role="dialog" aria-modal="true" aria-labelledby="edit-title">
      <header className="native-sheet-header">
        <h2 id="edit-title">{mode === 'rounds' ? 'EDITAR RONDAS' : 'EDITAR TABATA'}</h2>
        <button type="button" className="native-done" onClick={finish}>
          CONCLUÍDO
        </button>
      </header>

      <div className="native-sheet-body">
        <p className="edit-intro">
          Ajuste os tempos e a quantidade. Toque em <strong>CONCLUÍDO</strong> para guardar.
        </p>

        {fields.map((field) => {
          const value = Number((draft as unknown as Record<string, number>)[field.key] ?? 0)
          return (
            <div key={field.key} className="edit-field">
              <div className="edit-field-label">{field.label}</div>
              <div className="stepper">
                <button
                  type="button"
                  className="stepper-btn"
                  aria-label={`Diminuir ${field.label}`}
                  onClick={() => bump(field.key, -field.step, field.min, field.max)}
                >
                  −
                </button>
                <div className="stepper-value">{formatValue(value, field.count)}</div>
                <button
                  type="button"
                  className="stepper-btn"
                  aria-label={`Aumentar ${field.label}`}
                  onClick={() => bump(field.key, field.step, field.min, field.max)}
                >
                  +
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
