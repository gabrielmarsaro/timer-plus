import { Capacitor } from '@capacitor/core'
import { StatusBar, Style } from '@capacitor/status-bar'
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from 'react'
import { BottomNav } from './components/BottomNav'
import { GeneralSettingsModal } from './components/GeneralSettingsModal'
import { FirstRunCoach } from './components/FirstRunCoach'
import { MoreScreen } from './components/MoreScreen'
import { RoundsScreen } from './components/RoundsScreen'
import { StopwatchScreen } from './components/StopwatchScreen'
import { TabataScreen } from './components/TabataScreen'
import { WorkoutEditModal } from './components/WorkoutEditModal'
import { usePhaseTimer } from './hooks/usePhaseTimer'
import { useStopwatch } from './hooks/useStopwatch'
import { useWakeLock } from './hooks/useWakeLock'
import {
  announceDone,
  configureFeedback,
  ensureAudioReady,
  feedbackPhaseStart,
  onCountdownSecond,
  previewSound,
  unlockFeedback,
} from './lib/feedback'
import { pauseWorkoutMusic, stopWorkoutMusic, syncWorkoutMusic } from './lib/workoutMusic'
import { buildPhases, buildRoundsPhases } from './lib/buildPhases'
import { primeLockScreenAudio, syncLockScreen, stopLockScreen } from './lib/lockScreen'
import {
  DEFAULT_GENERAL_SETTINGS,
  DEFAULT_ROUNDS_SETTINGS,
  DEFAULT_SETTINGS,
  PHASE_LABELS,
  type GeneralSettings,
  type RoundsSettings,
  type Tab,
  type TabataSettings,
} from './types'

const TABATA_KEY = 'timer-plus:tabata-settings'
const ROUNDS_KEY = 'timer-plus:rounds-settings'
const GENERAL_KEY = 'timer-plus:general-settings'

function loadJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return fallback
    return { ...fallback, ...JSON.parse(raw) }
  } catch {
    return fallback
  }
}

function loadTabataSettings(): TabataSettings {
  const loaded = loadJson(TABATA_KEY, DEFAULT_SETTINGS)
  // Migra o default antigo (15 min de “exercício”) para o protocolo clássico 20/10×8.
  if (loaded.work === 900 && loaded.rounds === 3) {
    return { ...DEFAULT_SETTINGS }
  }
  return loaded
}

function loadGeneralSettings(): GeneralSettings {
  const loaded = loadJson(GENERAL_KEY, DEFAULT_GENERAL_SETTINGS) as GeneralSettings & {
    workoutMusicMode?: string
    workoutMusicTrack?: string
  }
  const legacyMode = loaded.workoutMusicMode
  const music =
    typeof loaded.workoutMusic === 'boolean'
      ? loaded.workoutMusic
      : legacyMode
        ? legacyMode !== 'off'
        : DEFAULT_GENERAL_SETTINGS.workoutMusic
  const track =
    loaded.workoutMusicTrack === 'drive' || loaded.workoutMusicTrack === 'storm'
      ? loaded.workoutMusicTrack
      : 'pulse'
  return {
    ...DEFAULT_GENERAL_SETTINGS,
    ...loaded,
    workoutMusic: music,
    workoutMusicTrack: track,
  }
}

async function lockOrientation(allowRotation: boolean): Promise<void> {
  try {
    const orientation = screen.orientation as ScreenOrientation & {
      lock?: (orientation: string) => Promise<void>
      unlock?: () => void
    }
    if (allowRotation) {
      orientation.unlock?.()
      return
    }
    await orientation.lock?.('portrait')
  } catch {
    // Orientation lock is best-effort on browsers/tablets.
  }
}

export default function App() {
  const [tab, setTab] = useState<Tab>('tabata')
  const [tabataSettings, setTabataSettings] = useState<TabataSettings>(() =>
    loadTabataSettings(),
  )
  const [roundsSettings, setRoundsSettings] = useState<RoundsSettings>(() =>
    loadJson(ROUNDS_KEY, DEFAULT_ROUNDS_SETTINGS),
  )
  const [generalSettings, setGeneralSettings] = useState<GeneralSettings>(() =>
    loadGeneralSettings(),
  )
  const [generalOpen, setGeneralOpen] = useState(false)
  const [workoutEditOpen, setWorkoutEditOpen] = useState(false)
  const [screenFlash, setScreenFlash] = useState(false)
  const [coachOpen, setCoachOpen] = useState(() => {
    try {
      return localStorage.getItem('timer-viking:onboarding-v1') !== '1'
    } catch {
      return true
    }
  })

  const flashScreen = useCallback(() => {
    if (!generalSettings.screenFlash) return
    setScreenFlash(true)
    window.setTimeout(() => setScreenFlash(false), 160)
  }, [generalSettings.screenFlash])

  const tabataPhases = useMemo(() => buildPhases(tabataSettings), [tabataSettings])
  const roundsPhases = useMemo(() => buildRoundsPhases(roundsSettings), [roundsSettings])

  const tabata = usePhaseTimer(tabataPhases, {
    totalRounds: tabataSettings.rounds,
    totalCycles: tabataSettings.cycles,
    onStart: (phase, next) => {
      flashScreen()
      if (generalSettings.workoutMusic) {
        syncWorkoutMusic(phase, true, phase.duration)
      }
      feedbackPhaseStart(phase, next)
    },
    onPhaseChange: (phase, next) => {
      flashScreen()
      if (generalSettings.workoutMusic) {
        syncWorkoutMusic(phase, true, phase.duration)
      }
      feedbackPhaseStart(phase, next)
    },
    onSecond: (remaining, phase) => {
      const warning =
        phase.kind === 'work' ? Math.max(3, Math.floor(phase.duration / 2)) : 0
      onCountdownSecond(remaining, phase, warning)
    },
    onComplete: () => {
      flashScreen()
      announceDone()
    },
  })

  const rounds = usePhaseTimer(roundsPhases, {
    totalRounds: roundsSettings.rounds,
    totalCycles: 1,
    onStart: (phase, next) => {
      flashScreen()
      stopWorkoutMusic()
      feedbackPhaseStart(phase, next)
    },
    onPhaseChange: (phase, next) => {
      flashScreen()
      feedbackPhaseStart(phase, next)
    },
    onSecond: (remaining, phase) => {
      onCountdownSecond(remaining, phase, roundsSettings.warning)
    },
    onComplete: () => {
      flashScreen()
      announceDone()
    },
  })

  const stopwatch = useStopwatch()

  const activeRunning =
    (tab === 'tabata' && tabata.status === 'running') ||
    (tab === 'rounds' && rounds.status === 'running') ||
    (tab === 'stopwatch' && stopwatch.status === 'running')

  useWakeLock(activeRunning)

  // Lock screen: only whole displayed seconds (ceil) — never every rAF float tick.
  const tabataLockSec = Math.ceil(tabata.phaseRemaining)
  const roundsLockSec = Math.ceil(rounds.phaseRemaining)
  const stopwatchLockSec = Math.floor(stopwatch.elapsedMs / 1000)
  const tabataRef = useRef(tabata)
  const roundsRef = useRef(rounds)
  const stopwatchRef = useRef(stopwatch)
  tabataRef.current = tabata
  roundsRef.current = rounds
  stopwatchRef.current = stopwatch

  // Lock screen Now Playing (Safari) / Media Session notification (Android).
  useEffect(() => {
    const tabataLive =
      tab === 'tabata' &&
      (tabata.status === 'running' || tabata.status === 'paused') &&
      tabata.currentPhase
    if (tabataLive && tabata.currentPhase) {
      const phase = tabata.currentPhase
      syncLockScreen(
        {
          mode: 'tabata',
          phaseLabel: phase.label || PHASE_LABELS[phase.kind],
          seconds: tabataLockSec,
          durationSeconds: phase.duration,
          running: tabata.status === 'running',
          paused: tabata.status === 'paused',
        },
        (action) => {
          const t = tabataRef.current
          if (action === 'pause') {
            pauseWorkoutMusic()
            t.pause()
          } else if (action === 'resume') {
            void t.resume()
          } else if (action === 'stop') {
            t.reset()
            stopWorkoutMusic()
          }
        },
      )
      return
    }
    const roundsLive =
      tab === 'rounds' &&
      (rounds.status === 'running' || rounds.status === 'paused') &&
      rounds.currentPhase
    if (roundsLive && rounds.currentPhase) {
      const phase = rounds.currentPhase
      syncLockScreen(
        {
          mode: 'rounds',
          phaseLabel: phase.label || PHASE_LABELS[phase.kind],
          seconds: roundsLockSec,
          durationSeconds: phase.duration,
          running: rounds.status === 'running',
          paused: rounds.status === 'paused',
        },
        (action) => {
          const r = roundsRef.current
          if (action === 'pause') r.pause()
          else if (action === 'resume') void r.resume()
          else if (action === 'stop') r.reset()
        },
      )
      return
    }
    if (
      tab === 'stopwatch' &&
      (stopwatch.status === 'running' || stopwatch.status === 'paused')
    ) {
      syncLockScreen(
        {
          mode: 'stopwatch',
          phaseLabel: 'Cronómetro',
          seconds: stopwatchLockSec,
          durationSeconds: Math.max(60, stopwatchLockSec + 1),
          running: stopwatch.status === 'running',
          paused: stopwatch.status === 'paused',
        },
        (action) => {
          const s = stopwatchRef.current
          if (action === 'pause') s.pause()
          else if (action === 'resume') s.resume()
          else if (action === 'stop') s.reset()
        },
      )
      return
    }
    stopLockScreen()
  }, [
    tab,
    tabata.currentPhase,
    tabata.status,
    tabataLockSec,
    rounds.currentPhase,
    rounds.status,
    roundsLockSec,
    stopwatch.status,
    stopwatchLockSec,
  ])

  useEffect(() => {
    return () => {
      void stopLockScreen()
    }
  }, [])

  useEffect(() => {
    localStorage.setItem(TABATA_KEY, JSON.stringify(tabataSettings))
  }, [tabataSettings])

  useEffect(() => {
    localStorage.setItem(ROUNDS_KEY, JSON.stringify(roundsSettings))
  }, [roundsSettings])

  useEffect(() => {
    localStorage.setItem(GENERAL_KEY, JSON.stringify(generalSettings))
    configureFeedback(generalSettings)
    document.documentElement.dataset.lightColors = generalSettings.lightColors
      ? 'true'
      : 'false'
    void lockOrientation(generalSettings.rotation)
  }, [generalSettings])

  // Nossa música Tabata — só na aba Tabata; segue preparar/esforço/pausa/ciclo/cooldown.
  useEffect(() => {
    if (tab !== 'tabata') {
      stopWorkoutMusic()
      return
    }
    const running = tabata.status === 'running'
    syncWorkoutMusic(tabata.currentPhase, running, tabata.phaseRemaining)
    if (tabata.status === 'paused') pauseWorkoutMusic()
    if (tabata.status === 'idle') stopWorkoutMusic()
  }, [tab, tabata.status, tabata.currentPhase, tabata.phaseRemaining])

  useEffect(() => {
    const warmVoices = () => {
      try {
        window.speechSynthesis?.getVoices()
      } catch {
        // ignore
      }
    }
    warmVoices()
    window.speechSynthesis?.addEventListener?.('voiceschanged', warmVoices)
    return () => window.speechSynthesis?.removeEventListener?.('voiceschanged', warmVoices)
  }, [])

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') void ensureAudioReady()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [])

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return
    void StatusBar.setStyle({
      style: generalSettings.lightColors ? Style.Light : Style.Dark,
    })
    void StatusBar.setBackgroundColor({
      color: generalSettings.lightColors ? '#f4f4f4' : '#0B0E12',
    })
  }, [generalSettings.lightColors])

  /** Só um cronómetro ativo: ao iniciar um, zera os outros. */
  const stopOtherActivities = useCallback(
    (keep: 'tabata' | 'rounds' | 'stopwatch') => {
      if (keep !== 'tabata' && tabata.status !== 'idle') {
        tabata.reset()
        stopWorkoutMusic()
      }
      if (keep !== 'rounds' && rounds.status !== 'idle') {
        rounds.reset()
      }
      if (keep !== 'stopwatch' && stopwatch.status !== 'idle') {
        stopwatch.reset()
      }
    },
    [rounds, stopwatch, tabata],
  )

  /** Navegar não destrói o treino — só INICIAR noutro modo para os outros. */
  const selectTab = useCallback((next: Tab) => {
    setTab(next)
  }, [])

  const makeToggle =
    (timer: typeof tabata, kind: 'tabata' | 'rounds') =>
    () => {
      unlockFeedback()
      primeLockScreenAudio()

      if (timer.status === 'running') {
        pauseWorkoutMusic()
        timer.pause()
        return
      }
      if (timer.status === 'paused') {
        void timer.resume()
        return
      }
      stopOtherActivities(kind)
      void timer.start()
    }

  const toggleStopwatch = () => {
    unlockFeedback()
    primeLockScreenAudio()
    if (stopwatch.status === 'running') {
      stopwatch.pause()
      return
    }
    if (stopwatch.status === 'paused') {
      stopwatch.resume()
      return
    }
    stopOtherActivities('stopwatch')
    stopWorkoutMusic()
    stopwatch.start()
    previewSound()
  }

  const markLap = () => {
    unlockFeedback()
    stopwatch.lap()
    previewSound()
  }

  const timerLive =
    (tab === 'tabata' && tabata.status !== 'idle') ||
    (tab === 'rounds' && rounds.status !== 'idle')

  const livePhaseColor =
    tab === 'tabata' && tabata.currentPhase
      ? tabata.currentPhase.color
      : tab === 'rounds' && rounds.currentPhase
        ? rounds.currentPhase.color
        : undefined

  return (
    <div
      className={`app-shell${screenFlash ? ' is-flashing' : ''}${
        generalSettings.lightColors ? ' theme-light' : ''
      }${timerLive ? ' is-timer-live' : ''}`}
      style={
        livePhaseColor
          ? ({ ['--phase-color' as string]: livePhaseColor } as CSSProperties)
          : undefined
      }
    >
      <main className="app-main">
        {tab === 'tabata' && (
          <TabataScreen
            status={tabata.status}
            currentPhase={tabata.currentPhase}
            nextPhase={tabata.nextPhase}
            phaseRemaining={
              tabata.status === 'idle' ? tabataSettings.prepare : tabata.phaseRemaining
            }
            totalRemaining={tabata.totalRemaining}
            roundsLeft={tabata.roundsLeft}
            cyclesLeft={tabata.cyclesLeft}
            currentRoundNumber={tabata.currentRoundNumber}
            totalRounds={tabata.sessionTotalRounds}
            idleWorkDuration={tabataSettings.work}
            timeFormat={generalSettings.timeFormat}
            onOpenGeneralSettings={() => setGeneralOpen(true)}
            onOpenWorkoutEdit={() => setWorkoutEditOpen(true)}
            onToggle={makeToggle(tabata, 'tabata')}
            onReset={tabata.reset}
            onSkip={() => {
              unlockFeedback()
              tabata.skipPhase()
            }}
            onExtend={() => {
              unlockFeedback()
              tabata.extendPhase(15)
            }}
          />
        )}

        {tab === 'rounds' && (
          <RoundsScreen
            status={rounds.status}
            currentPhase={rounds.currentPhase}
            nextPhase={rounds.nextPhase}
            phaseRemaining={rounds.phaseRemaining}
            totalRemaining={rounds.totalRemaining}
            roundsLeft={rounds.roundsLeft}
            currentRoundNumber={rounds.currentRoundNumber}
            totalRounds={rounds.sessionTotalRounds}
            idlePrepare={roundsSettings.prepare}
            idleRoundDuration={roundsSettings.round}
            timeFormat={generalSettings.timeFormat}
            onOpenGeneralSettings={() => setGeneralOpen(true)}
            onOpenWorkoutEdit={() => setWorkoutEditOpen(true)}
            onToggle={makeToggle(rounds, 'rounds')}
            onReset={rounds.reset}
            onSkip={() => {
              unlockFeedback()
              rounds.skipPhase()
            }}
            onExtend={() => {
              unlockFeedback()
              rounds.extendPhase(15)
            }}
          />
        )}

        {tab === 'stopwatch' && (
          <StopwatchScreen
            status={stopwatch.status}
            elapsedMs={stopwatch.elapsedMs}
            laps={stopwatch.laps}
            onOpenGeneralSettings={() => setGeneralOpen(true)}
            onToggle={toggleStopwatch}
            onLap={markLap}
            onReset={stopwatch.reset}
          />
        )}

        {tab === 'more' && (
          <MoreScreen
            onOpenGeneralSettings={() => setGeneralOpen(true)}
            onGoTabata={() => selectTab('tabata')}
            onGoRounds={() => selectTab('rounds')}
            onGoStopwatch={() => selectTab('stopwatch')}
          />
        )}
      </main>

      <BottomNav active={tab} onChange={selectTab} />

      <FirstRunCoach
        open={coachOpen}
        onClose={() => {
          try {
            localStorage.setItem('timer-viking:onboarding-v1', '1')
          } catch {
            // ignore
          }
          setCoachOpen(false)
        }}
      />

      {generalOpen ? (
        <GeneralSettingsModal
          open={generalOpen}
          settings={generalSettings}
          onChange={setGeneralSettings}
          onClose={() => setGeneralOpen(false)}
        />
      ) : null}

      {workoutEditOpen ? (
        <WorkoutEditModal
          open={workoutEditOpen}
          mode={tab === 'rounds' ? 'rounds' : 'tabata'}
          settings={tab === 'rounds' ? roundsSettings : tabataSettings}
          onClose={() => setWorkoutEditOpen(false)}
          onSave={(next) => {
            // Guarda sempre; só reinicia se não houver sessão a meio
            // (a sessão ativa mantém as fases congeladas até reset).
            if (tab === 'rounds') {
              setRoundsSettings(next as RoundsSettings)
              if (rounds.status === 'idle' || rounds.status === 'finished') {
                rounds.reset()
              }
              return
            }
            setTabataSettings(next as TabataSettings)
            if (tabata.status === 'idle' || tabata.status === 'finished') {
              tabata.reset()
            }
          }}
        />
      ) : null}
    </div>
  )
}
