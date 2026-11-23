import { useEffect, useState } from 'react'
import { CountWheel, DurationWheel } from './WheelPicker'
import { CLASSIC_TABATA_PRESET, type RoundsSettings, type TabataSettings } from '../types'

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
  { key: 'prepare', label: 'PREPARAR', min: 0, max: 600, step: 1 },
  { key: 'work', label: 'EXERCÍCIO', min: 1, max: 3600, step: 1 },
  { key: 'rest', label: 'DESCANSO (PAUSA)', min: 0, max: 600, step: 1 },
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

function formatPreview(value: number, count?: boolean): string {
  if (count) return String(value)
  const mins = Math.floor(value / 60)
  const secs = value % 60
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
}

export function WorkoutEditModal({
  open,
  mode,
  settings,
  onClose,
  onSave,
}: WorkoutEditModalProps) {
  const [draft, setDraft] = useState(settings)
  const [activeKey, setActiveKey] = useState<string | null>(null)
  const fields = mode === 'tabata' ? TABATA_FIELDS : ROUNDS_FIELDS

  useEffect(() => {
    if (!open) return
    setDraft(settings)
    setActiveKey(null)
  }, [open, settings])

  if (!open) return null

  const activeField = fields.find((field) => field.key === activeKey) ?? null
  const activeValue = activeField
    ? Number((draft as unknown as Record<string, number>)[activeField.key] ?? activeField.min)
    : 0

  const setValue = (key: string, value: number) => {
    setDraft((prev) => ({ ...prev, [key]: value }))
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

      <div className="native-sheet-body edit-sheet-body">
        <p className="edit-intro">
          {mode === 'tabata' ? (
            <>
              Clássico: <strong>20s esforço / 10s pausa × 8 rondas</strong> (+ preparar, descanso
              entre ciclos, cooldown). Toque num valor e deslize.
            </>
          ) : (
            <>
              Toque em um valor para abrir o seletor no <strong>centro da tela</strong> e deslize.
            </>
          )}
        </p>

        {mode === 'tabata' ? (
          <button
            type="button"
            className="edit-preset-btn"
            onClick={() => {
              setDraft({ ...CLASSIC_TABATA_PRESET })
              setActiveKey(null)
            }}
          >
            PRESET CLÁSSICO 20/10 × 8
          </button>
        ) : null}

        <div className="edit-rows">
          {fields.map((field) => {
            const value = Number((draft as unknown as Record<string, number>)[field.key] ?? 0)
            const selected = field.key === activeKey
            return (
              <button
                key={field.key}
                type="button"
                className={`edit-row${selected ? ' is-selected' : ''}`}
                onClick={() => setActiveKey(field.key)}
              >
                <span>{field.label}</span>
                <strong>{formatPreview(value, field.count)}</strong>
              </button>
            )
          })}
        </div>
      </div>

      {activeField ? (
        <div
          className="wheel-overlay"
          role="presentation"
          onClick={() => setActiveKey(null)}
        >
          <div
            className="wheel-card"
            role="dialog"
            aria-label={`Ajustar ${activeField.label}`}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="wheel-card-header">
              <span>{activeField.label}</span>
              <button type="button" className="native-done" onClick={() => setActiveKey(null)}>
                PRONTO
              </button>
            </div>

            <div className="wheel-card-body">
              {activeField.count ? (
                <CountWheel
                  label={activeField.label}
                  value={activeValue}
                  min={activeField.min}
                  max={activeField.max}
                  step={activeField.step}
                  onChange={(value) => setValue(activeField.key, value)}
                />
              ) : (
                <DurationWheel
                  label={activeField.label}
                  value={activeValue}
                  min={activeField.min}
                  max={activeField.max}
                  step={activeField.step}
                  onChange={(value) => setValue(activeField.key, value)}
                />
              )}
            </div>

            <div className="wheel-card-value">
              {formatPreview(activeValue, activeField.count)}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
