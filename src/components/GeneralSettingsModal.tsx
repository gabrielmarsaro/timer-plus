import { useEffect, useState } from 'react'
import type { GeneralSettings } from '../types'

interface GeneralSettingsModalProps {
  open: boolean
  settings: GeneralSettings
  onClose: () => void
  onSave: (settings: GeneralSettings) => void
}

const SOUND_TYPES: Array<{ id: GeneralSettings['soundType']; label: string }> = [
  { id: 'censor', label: 'CENSOR' },
  { id: 'beep', label: 'BEEP' },
  { id: 'bell', label: 'SINO' },
]

const VOICES: Array<{ id: GeneralSettings['voice']; label: string }> = [
  { id: 'luciana', label: 'LUCIANA' },
  { id: 'sistema', label: 'SISTEMA' },
]

export function GeneralSettingsModal({
  open,
  settings,
  onClose,
  onSave,
}: GeneralSettingsModalProps) {
  const [draft, setDraft] = useState(settings)

  useEffect(() => {
    if (open) setDraft(settings)
  }, [open, settings])

  if (!open) return null

  const toggle = (key: keyof GeneralSettings) => {
    setDraft((prev) => ({
      ...prev,
      [key]: !prev[key],
    }))
  }

  const cycleSoundType = () => {
    const idx = SOUND_TYPES.findIndex((item) => item.id === draft.soundType)
    const next = SOUND_TYPES[(idx + 1) % SOUND_TYPES.length]
    setDraft((prev) => ({ ...prev, soundType: next.id }))
  }

  const cycleVoice = () => {
    const idx = VOICES.findIndex((item) => item.id === draft.voice)
    const next = VOICES[(idx + 1) % VOICES.length]
    setDraft((prev) => ({ ...prev, voice: next.id }))
  }

  const finish = () => {
    onSave(draft)
    onClose()
  }

  return (
    <div className="native-sheet" role="dialog" aria-modal="true" aria-labelledby="cfg-title">
      <header className="native-sheet-header">
        <h2 id="cfg-title">CONFIGURAÇÕES</h2>
        <button type="button" className="native-done" onClick={finish}>
          CONCLUÍDO
        </button>
      </header>

      <div className="native-sheet-body">
        <label className="native-row">
          <span>EFEITO SONORO</span>
          <button
            type="button"
            className={`toggle${draft.soundEffect ? ' is-on' : ''}`}
            aria-pressed={draft.soundEffect}
            onClick={() => toggle('soundEffect')}
          />
        </label>

        <button type="button" className="native-row native-link" onClick={cycleSoundType}>
          <span>TIPO DE SOM</span>
          <span className="native-value">
            {SOUND_TYPES.find((item) => item.id === draft.soundType)?.label} ›
          </span>
        </button>

        <div className="native-row native-volume">
          <span className="volume-icon" aria-hidden>
            ◂
          </span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={draft.volume}
            onChange={(event) =>
              setDraft((prev) => ({ ...prev, volume: Number(event.target.value) }))
            }
            aria-label="Volume"
          />
          <span className="volume-icon" aria-hidden>
            ◂))
          </span>
        </div>

        <label className="native-row">
          <span>ASSISTENTE DE VOZ</span>
          <button
            type="button"
            className={`toggle${draft.voiceAssistant ? ' is-on' : ''}`}
            aria-pressed={draft.voiceAssistant}
            onClick={() => toggle('voiceAssistant')}
          />
        </label>

        <button type="button" className="native-row native-link" onClick={cycleVoice}>
          <span>VOZ</span>
          <span className="native-value">
            {VOICES.find((item) => item.id === draft.voice)?.label} ›
          </span>
        </button>

        <label className="native-row native-row-stack">
          <div>
            <span>DUCKING</span>
            <small>REDUZIR VOLUME DA MÚSICA</small>
          </div>
          <button
            type="button"
            className={`toggle${draft.ducking ? ' is-on' : ''}`}
            aria-pressed={draft.ducking}
            onClick={() => toggle('ducking')}
          />
        </label>

        <label className="native-row">
          <span>SOM DE TIQUE-TAQUE</span>
          <button
            type="button"
            className={`toggle${draft.ticking ? ' is-on' : ''}`}
            aria-pressed={draft.ticking}
            onClick={() => toggle('ticking')}
          />
        </label>

        <label className="native-row">
          <span>VIBRAÇÃO</span>
          <button
            type="button"
            className={`toggle${draft.vibration ? ' is-on' : ''}`}
            aria-pressed={draft.vibration}
            onClick={() => toggle('vibration')}
          />
        </label>

        <label className="native-row native-row-stack">
          <div>
            <span>LANTERNA</span>
            <small>LANTERNA FUNCIONA APENAS NO PRIMEIRO PLANO</small>
          </div>
          <button
            type="button"
            className={`toggle${draft.flashlight ? ' is-on' : ''}`}
            aria-pressed={draft.flashlight}
            onClick={() => toggle('flashlight')}
          />
        </label>

        <label className="native-row native-row-stack">
          <div>
            <span>ECRÃ FLASH</span>
            <small>O FLASH DA TELA FUNCIONA APENAS NO MODO DE PRIMEIRO PLANO</small>
          </div>
          <button
            type="button"
            className={`toggle${draft.screenFlash ? ' is-on' : ''}`}
            aria-pressed={draft.screenFlash}
            onClick={() => toggle('screenFlash')}
          />
        </label>

        <label className="native-row native-row-stack">
          <div>
            <span>ROTAÇÃO</span>
            <small>PERMITIR QUE O ECRÃ RODE DURANTE OS EXERCÍCIOS</small>
          </div>
          <button
            type="button"
            className={`toggle${draft.rotation ? ' is-on' : ''}`}
            aria-pressed={draft.rotation}
            onClick={() => toggle('rotation')}
          />
        </label>

        <label className="native-row">
          <span>CORES CLARAS</span>
          <button
            type="button"
            className={`toggle${draft.lightColors ? ' is-on' : ''}`}
            aria-pressed={draft.lightColors}
            onClick={() => toggle('lightColors')}
          />
        </label>

        <div className="native-row native-link">
          <span>FORMATO DE TEMPO</span>
          <span className="native-value">00:00 ›</span>
        </div>

        <p className="native-version">VERSÃO: 1.0.0</p>
      </div>
    </div>
  )
}
