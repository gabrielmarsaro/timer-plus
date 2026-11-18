import { useEffect, useState } from 'react'
import type { TabataSettings } from '../types'

interface SettingsModalProps {
  open: boolean
  settings: TabataSettings
  onClose: () => void
  onSave: (settings: TabataSettings) => void
}

const FIELDS: Array<{
  key: keyof TabataSettings
  label: string
  min: number
  max: number
  step: number
  unit: string
}> = [
  { key: 'prepare', label: 'Preparar', min: 0, max: 600, step: 5, unit: 's' },
  { key: 'work', label: 'Exercício', min: 1, max: 3600, step: 5, unit: 's' },
  { key: 'rest', label: 'Descanso', min: 0, max: 600, step: 5, unit: 's' },
  { key: 'rounds', label: 'Rondas', min: 1, max: 99, step: 1, unit: '' },
  { key: 'cycles', label: 'Ciclos', min: 1, max: 20, step: 1, unit: '' },
  { key: 'cycleRest', label: 'Descanso entre ciclos', min: 0, max: 600, step: 5, unit: 's' },
  { key: 'cooldown', label: 'Cooldown', min: 0, max: 600, step: 5, unit: 's' },
]

function formatFieldValue(key: keyof TabataSettings, value: number): string {
  if (key === 'rounds' || key === 'cycles') return String(value)
  const mins = Math.floor(value / 60)
  const secs = value % 60
  if (mins === 0) return `${secs}s`
  if (secs === 0) return `${mins}m`
  return `${mins}m ${secs}s`
}

export function SettingsModal({ open, settings, onClose, onSave }: SettingsModalProps) {
  const [draft, setDraft] = useState(settings)

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
          <h2 id="settings-title">Configurações</h2>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Fechar">
            ×
          </button>
        </div>

        <div className="settings-list">
          {FIELDS.map((field) => (
            <label key={field.key} className="settings-row">
              <div className="settings-row-top">
                <span>{field.label}</span>
                <strong>{formatFieldValue(field.key, draft[field.key])}</strong>
              </div>
              <input
                type="range"
                min={field.min}
                max={field.max}
                step={field.step}
                value={draft[field.key]}
                onChange={(event) =>
                  setDraft((prev) => ({
                    ...prev,
                    [field.key]: Number(event.target.value),
                  }))
                }
              />
            </label>
          ))}
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
