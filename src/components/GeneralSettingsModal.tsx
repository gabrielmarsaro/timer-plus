import { useEffect, useState } from 'react'
import { TIME_FORMATS } from '../lib/format'
import { previewSound, previewVoice, unlockFeedback } from '../lib/feedback'
import { previewWorkoutTrack, WORKOUT_TRACKS } from '../lib/workoutMusic'
import { getYoutubeTrack, openYoutubeExternally, YOUTUBE_TABATA_TRACKS } from '../lib/youtubeTabata'
import type { GeneralSettings, WorkoutMusicMode } from '../types'

const MUSIC_MODES: Array<{ id: WorkoutMusicMode; label: string }> = [
  { id: 'youtube', label: 'YOUTUBE' },
  { id: 'beats', label: 'BATIDAS OFFLINE' },
  { id: 'off', label: 'DESLIGADA' },
]

interface GeneralSettingsModalProps {
  open: boolean
  settings: GeneralSettings
  onChange: (settings: GeneralSettings) => void
  onClose: () => void
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
  onChange,
  onClose,
}: GeneralSettingsModalProps) {
  const [draft, setDraft] = useState(settings)

  useEffect(() => {
    if (open) setDraft(settings)
  }, [open, settings])

  if (!open) return null

  const update = (patch: Partial<GeneralSettings>) => {
    const next = { ...draft, ...patch }
    setDraft(next)
    onChange(next)
  }

  const toggle = (key: keyof GeneralSettings) => {
    update({ [key]: !draft[key] } as Partial<GeneralSettings>)
  }

  return (
    <div className="native-sheet" role="dialog" aria-modal="true" aria-labelledby="cfg-title">
      <header className="native-sheet-header">
        <h2 id="cfg-title">CONFIGURAÇÕES</h2>
        <button type="button" className="native-done" onClick={onClose}>
          CONCLUÍDO
        </button>
      </header>

      <div className="native-sheet-body">
        <p className="settings-note">
          No iPhone o app roda no Safari (a Apple não deixa instalar APK). Para ouvir sons:
          desative o mute lateral, aumente o volume e toque em INICIAR.
        </p>

        <label className="native-row">
          <span>EFEITO SONORO</span>
          <button
            type="button"
            className={`toggle${draft.soundEffect ? ' is-on' : ''}`}
            aria-pressed={draft.soundEffect}
            onClick={() => toggle('soundEffect')}
          />
        </label>

        <button
          type="button"
          className="native-row native-link"
          onClick={() => {
            const idx = SOUND_TYPES.findIndex((item) => item.id === draft.soundType)
            const next = SOUND_TYPES[(idx + 1) % SOUND_TYPES.length]
            update({ soundType: next.id })
            window.setTimeout(() => previewSound(), 40)
          }}
        >
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
            onChange={(event) => update({ volume: Number(event.target.value) })}
            onPointerUp={() => previewSound()}
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
            onClick={() => {
              const enabled = !draft.voiceAssistant
              update({ voiceAssistant: enabled })
              if (enabled) window.setTimeout(() => previewVoice(), 80)
            }}
          />
        </label>

        <button
          type="button"
          className="native-row native-link"
          onClick={() => {
            const idx = VOICES.findIndex((item) => item.id === draft.voice)
            const next = VOICES[(idx + 1) % VOICES.length]
            update({ voice: next.id, voiceAssistant: true })
            window.setTimeout(() => previewVoice(), 80)
          }}
        >
          <span>VOZ</span>
          <span className="native-value">
            {VOICES.find((item) => item.id === draft.voice)?.label} ›
          </span>
        </button>

        <label className="native-row native-row-stack">
          <div>
            <span>RESPEITAR MÚSICA</span>
            <small>
              SE SPOTIFY/DEEZER/YOUTUBE ESTIVER TOCANDO, TIRA O TIQUE-TAQUE E A BATIDA DO APP —
              DEIXA SÓ ALERTAS DE INÍCIO/FIM
            </small>
          </div>
          <button
            type="button"
            className={`toggle${draft.ducking ? ' is-on' : ''}`}
            aria-pressed={draft.ducking}
            onClick={() => toggle('ducking')}
          />
        </label>

        <button
          type="button"
          className="native-row native-link native-row-stack"
          onClick={() => {
            const idx = MUSIC_MODES.findIndex((item) => item.id === draft.workoutMusicMode)
            const next = MUSIC_MODES[(idx + 1) % MUSIC_MODES.length]!
            update({ workoutMusicMode: next.id })
            if (next.id === 'beats') {
              window.setTimeout(() => {
                unlockFeedback()
                previewWorkoutTrack(
                  draft.workoutMusicTrack === 'off' ? 'pulse' : draft.workoutMusicTrack,
                )
              }, 60)
            }
          }}
        >
          <div>
            <span>MÚSICA TABATA</span>
            <small>
              YOUTUBE = VÍDEOS PÚBLICOS (PLAYER NO APP OU APP YOUTUBE). BATIDAS = RITMO OFFLINE DO
              APP. NÃO BAIXAMOS ÁUDIO DO YOUTUBE.
            </small>
          </div>
          <span className="native-value">
            {MUSIC_MODES.find((item) => item.id === draft.workoutMusicMode)?.label} ›
          </span>
        </button>

        {draft.workoutMusicMode === 'youtube' ? (
          <button
            type="button"
            className="native-row native-link native-row-stack"
            onClick={() => {
              const idx = YOUTUBE_TABATA_TRACKS.findIndex(
                (item) => item.id === draft.youtubeTrackId,
              )
              const next = YOUTUBE_TABATA_TRACKS[(idx + 1) % YOUTUBE_TABATA_TRACKS.length]!
              update({ youtubeTrackId: next.id })
            }}
          >
            <div>
              <span>FAIXA YOUTUBE</span>
              <small>{getYoutubeTrack(draft.youtubeTrackId).blurb}</small>
            </div>
            <span className="native-value">{getYoutubeTrack(draft.youtubeTrackId).label} ›</span>
          </button>
        ) : null}

        {draft.workoutMusicMode === 'youtube' ? (
          <button
            type="button"
            className="native-row native-link"
            onClick={() => openYoutubeExternally(getYoutubeTrack(draft.youtubeTrackId).videoId)}
          >
            <span>ABRIR NO YOUTUBE</span>
            <span className="native-value">▶</span>
          </button>
        ) : null}

        {draft.workoutMusicMode === 'beats' ? (
          <button
            type="button"
            className="native-row native-link"
            onClick={() => {
              const options = WORKOUT_TRACKS.filter((item) => item.id !== 'off')
              const idx = options.findIndex((item) => item.id === draft.workoutMusicTrack)
              const next = options[(idx + 1) % options.length]!
              update({ workoutMusicTrack: next.id })
              window.setTimeout(() => {
                unlockFeedback()
                previewWorkoutTrack(next.id)
              }, 60)
            }}
          >
            <span>FAIXA OFFLINE</span>
            <span className="native-value">
              {WORKOUT_TRACKS.find((item) => item.id === draft.workoutMusicTrack)?.label} ›
            </span>
          </button>
        ) : null}

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

        <button
          type="button"
          className="native-row native-link"
          onClick={() => {
            const idx = TIME_FORMATS.findIndex((item) => item.id === draft.timeFormat)
            const next = TIME_FORMATS[(idx + 1) % TIME_FORMATS.length]
            update({ timeFormat: next.id })
          }}
        >
          <span>FORMATO DE TEMPO</span>
          <span className="native-value">
            {TIME_FORMATS.find((item) => item.id === draft.timeFormat)?.label} ›
          </span>
        </button>

        <p className="native-version">VERSÃO: 1.3.0</p>
      </div>
    </div>
  )
}
