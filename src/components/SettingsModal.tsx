import { useEffect, useState } from 'react'
import type { RoundsSettings, TabataSettings } from '../types'

type SettingsMode = 'tabata' | 'rounds'

type AnySettings = TabataSettings | RoundsSettings

interface FieldDef<T extends string> {
  key: T
  label: string
  min: number
  max: number
  step: number
  count?: boolean
}

const TABATA_FIELDS: FieldDef<keyof TabataSettings>[] = [
  { key: 'prepare', label: 'Preparar', min: 0, max: 600, step: 5 },
  { key: 'work', label: 'Exercício', min: 1, max: 3600, step: 5 },
  { key: 'rest', label: 'Descanso', min: 0, max: 600, step: 5 },
  { key: 'rounds', label: 'Rondas', min: 1, max: 99, step: 1, count: true },
  { key: 'cycles', label: 'Ciclos', min: 1, max: 20, step: 1, count: true },
  { key: 'cycleRest', label: 'Descanso entre ciclos', min: 0, max: 600, step: 5 },
  { key: 'cooldown', label: 'Cooldown', min: 0, max: 600, step: 5 },
]

const ROUNDS_FIELDS: FieldDef<keyof RoundsSettings>[] = [
  { key: 'prepare', label: 'Preparar', min: 0, max: 600, step: 5 },
  { key: 'round', label: 'Duração da ronda', min: 5, max: 600, step: 5 },
  { key: 'rest', label: 'Descanso', min: 0, max: 600, step: 5 },
  { key: 'rounds', label: 'Nº de rondas', min: 1, max: 99, step: 1, count: true },
  { key: 'warning', label: 'Aviso final', min: 0, max: 60, step: 5 },
]

interface SettingsModalProps {
  open: boolean
  mode: SettingsMode
  settings: AnySettings
  onClose: () => void
  onSave: (settings: AnySettings) => void
}

function formatFieldValue(value: number, count?: boolean): string {
  if (count) return String(value)
  const mins = Math.floor(value / 60)
  const secs = value % 60
  if (mins === 0) return `${secs}s`
  if (secs === 0) return `${mins}m`
  return `${mins}m ${secs}s`
}

export function SettingsModal({ open, mode, settings, onClose, onSave }: SettingsModalProps) {
  const [draft, setDraft] = useState<AnySettings>(settings)
  const fields = mode === 'tabata' ? TABATA_FIELDS : ROUNDS_FIELDS

  useEffect(() => {
    if (open) setDraft(settings)
  }, [open, settings])

  if (!open) return null

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
            {mode === 'tabata' ? 'Configurações Tabata' : 'Configurações Rondas'}
          </h2>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Fechar">
            ×
          </button>
        </div>

        <div className="settings-list">
          {fields.map((field) => {
            const value = Number((draft as unknown as Record<string, number>)[field.key] ?? 0)
            return (
              <label key={String(field.key)} className="settings-row">
                <div className="settings-row-top">
                  <span>{field.label}</span>
                  <strong>{formatFieldValue(value, field.count)}</strong>
                </div>
                <input
                  type="range"
                  min={field.min}
                  max={field.max}
                  step={field.step}
                  value={value}
                  onChange={(event) =>
                    setDraft((prev) => ({
                      ...prev,
                      [field.key]: Number(event.target.value),
                    }))
                  }
                />
              </label>
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
