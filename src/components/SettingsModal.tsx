import { useEffect, useState } from 'react'
import type { RoundsSettings, TabataSettings } from '../types'

type SettingsMode = 'tabata' | 'rounds'
type AnySettings = TabataSettings | RoundsSettings

interface FieldDef {
  key: string
  label: string
  hint?: string
  min: number
  max: number
  step: number
  count?: boolean
}

const TABATA_FIELDS: FieldDef[] = [
  { key: 'prepare', label: 'Preparar', hint: 'Contagem antes de começar', min: 0, max: 600, step: 5 },
  { key: 'work', label: 'Exercício', hint: 'Tempo de trabalho', min: 1, max: 3600, step: 5 },
  { key: 'rest', label: 'Descanso', hint: 'Entre exercícios', min: 0, max: 600, step: 5 },
  { key: 'rounds', label: 'Rondas', hint: 'Por ciclo', min: 1, max: 99, step: 1, count: true },
  { key: 'cycles', label: 'Ciclos', min: 1, max: 20, step: 1, count: true },
  { key: 'cycleRest', label: 'Descanso entre ciclos', min: 0, max: 600, step: 5 },
  { key: 'cooldown', label: 'Cooldown', min: 0, max: 600, step: 5 },
]

const ROUNDS_FIELDS: FieldDef[] = [
  { key: 'prepare', label: 'Preparar', hint: 'Antes da 1ª ronda', min: 0, max: 600, step: 5 },
  { key: 'round', label: 'Duração da ronda', hint: 'Tempo de luta/trabalho', min: 5, max: 900, step: 5 },
  { key: 'rest', label: 'Descanso', hint: 'Entre rondas', min: 0, max: 600, step: 5 },
  { key: 'rounds', label: 'Número de rondas', hint: 'Total do treino', min: 1, max: 99, step: 1, count: true },
  { key: 'warning', label: 'Aviso final', hint: 'Alerta antes do fim da ronda', min: 0, max: 60, step: 5 },
]

interface SettingsModalProps {
  open: boolean
  mode: SettingsMode
  settings: AnySettings
  focusKey?: string | null
  onClose: () => void
  onSave: (settings: AnySettings) => void
}

function formatFieldValue(value: number, count?: boolean): string {
  if (count) return String(value)
  const mins = Math.floor(value / 60)
  const secs = value % 60
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

export function SettingsModal({
  open,
  mode,
  settings,
  focusKey = null,
  onClose,
  onSave,
}: SettingsModalProps) {
  const [draft, setDraft] = useState<AnySettings>(settings)
  const fields = mode === 'tabata' ? TABATA_FIELDS : ROUNDS_FIELDS

  useEffect(() => {
    if (open) setDraft(settings)
  }, [open, settings])

  useEffect(() => {
    if (!open || !focusKey) return
    const el = document.getElementById(`settings-field-${focusKey}`)
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [open, focusKey])

  if (!open) return null

  const bump = (key: string, delta: number, min: number, max: number) => {
    setDraft((prev) => {
      const current = Number((prev as unknown as Record<string, number>)[key] ?? 0)
      return {
        ...prev,
        [key]: clamp(current + delta, min, max),
      }
    })
  }

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="modal-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal-header">
          <h2 id="settings-title">
            {mode === 'tabata' ? 'Configurar Tabata' : 'Configurar Rondas'}
          </h2>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Fechar">
            ×
          </button>
        </div>

        <p className="settings-intro">
          Use − / + para ajustar cada valor. Depois toque em <strong>Salvar</strong>.
        </p>

        <div className="settings-list">
          {fields.map((field) => {
            const value = Number((draft as unknown as Record<string, number>)[field.key] ?? 0)
            const focused = focusKey === field.key
            return (
              <div
                key={field.key}
                id={`settings-field-${field.key}`}
                className={`settings-card${focused ? ' is-focused' : ''}`}
              >
                <div className="settings-card-text">
                  <span className="settings-card-label">{field.label}</span>
                  {field.hint ? <span className="settings-card-hint">{field.hint}</span> : null}
                </div>

                <div className="stepper">
                  <button
                    type="button"
                    className="stepper-btn"
                    aria-label={`Diminuir ${field.label}`}
                    onClick={() => bump(field.key, -field.step, field.min, field.max)}
                  >
                    −
                  </button>
                  <div className="stepper-value" aria-live="polite">
                    {formatFieldValue(value, field.count)}
                  </div>
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

        <div className="modal-actions">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancelar
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={() => {
              onSave(draft)
              onClose()
            }}
          >
            Salvar
          </button>
        </div>
      </div>
    </div>
  )
}
