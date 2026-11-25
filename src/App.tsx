import { Capacitor } from '@capacitor/core'
import { StatusBar, Style } from '@capacitor/status-bar'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { BottomNav } from './components/BottomNav'
import { GeneralSettingsModal } from './components/GeneralSettingsModal'
import { IosAudioTip } from './components/IosAudioTip'
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
  isAppleTouchWeb,
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
  const [iosAudioTip, setIosAudioTip] = useState(false)

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

  // Lock screen Now Playing (Safari) / Media Session notification (Android).
  useEffect(() => {
    const tabataLive =
      tab === 'tabata' &&
      (tabata.status === 'running' || tabata.status === 'paused') &&
      tabata.currentPhase
    if (tabataLive && tabata.currentPhase) {
      syncLockScreen(
        {
          mode: 'tabata',
          phaseLabel: tabata.currentPhase.label || PHASE_LABELS[tabata.currentPhase.kind],
          seconds: tabata.phaseRemaining,
          durationSeconds: tabata.currentPhase.duration,
          running: tabata.status === 'running',
          paused: tabata.status === 'paused',
        },
        (action) => {
          if (action === 'pause') {
            pauseWorkoutMusic()
            tabata.pause()
          } else if (action === 'resume') {
            void tabata.resume()
          } else if (action === 'stop') {
            tabata.reset()
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
      syncLockScreen(
        {
          mode: 'rounds',
          phaseLabel: rounds.currentPhase.label || PHASE_LABELS[rounds.currentPhase.kind],
          seconds: rounds.phaseRemaining,
          durationSeconds: rounds.currentPhase.duration,
          running: rounds.status === 'running',
          paused: rounds.status === 'paused',
        },
        (action) => {
          if (action === 'pause') rounds.pause()
          else if (action === 'resume') void rounds.resume()
          else if (action === 'stop') rounds.reset()
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
          seconds: stopwatch.elapsedMs / 1000,
          durationSeconds: Math.max(60, stopwatch.elapsedMs / 1000 + 1),
          running: stopwatch.status === 'running',
          paused: stopwatch.status === 'paused',
        },
        (action) => {
          if (action === 'pause') stopwatch.pause()
          else if (action === 'resume') stopwatch.resume()
          else if (action === 'stop') stopwatch.reset()
        },
      )
      return
    }
    stopLockScreen()
  }, [
    rounds,
    stopwatch,
    tab,
    tabata,
    tabata.currentPhase,
    tabata.phaseRemaining,
    tabata.status,
    rounds.currentPhase,
    rounds.phaseRemaining,
    rounds.status,
    stopwatch.elapsedMs,
    stopwatch.status,
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
      color: generalSettings.lightColors ? '#f4f4f4' : '#000000',
    })
  }, [generalSettings.lightColors])

  const maybeShowIosTip = () => {
    if (!isAppleTouchWeb()) return
    const seen = sessionStorage.getItem('timer-plus:ios-audio-tip')
    if (!seen) {
      sessionStorage.setItem('timer-plus:ios-audio-tip', '1')
      window.setTimeout(() => setIosAudioTip(true), 500)
    }
  }

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

  const selectTab = useCallback(
    (next: Tab) => {
      if (next !== tab) {
        if (next !== 'tabata' && tabata.status !== 'idle') {
          tabata.reset()
          stopWorkoutMusic()
        }
        if (next !== 'rounds' && rounds.status !== 'idle') rounds.reset()
        if (next !== 'stopwatch' && stopwatch.status !== 'idle') stopwatch.reset()
      }
      setTab(next)
    },
    [rounds, stopwatch, tab, tabata],
  )

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
      maybeShowIosTip()
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
    maybeShowIosTip()
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

  return (
    <div
      className={`app-shell${screenFlash ? ' is-flashing' : ''}${
        generalSettings.lightColors ? ' theme-light' : ''
      }${timerLive ? ' is-timer-live' : ''}`}
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
            idleWorkDuration={tabataSettings.work}
            timeFormat={generalSettings.timeFormat}
            onOpenGeneralSettings={() => setGeneralOpen(true)}
            onOpenWorkoutEdit={() => setWorkoutEditOpen(true)}
            onToggle={makeToggle(tabata, 'tabata')}
            onReset={tabata.reset}
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
            idlePrepare={roundsSettings.prepare}
            idleRoundDuration={roundsSettings.round}
            timeFormat={generalSettings.timeFormat}
            onOpenGeneralSettings={() => setGeneralOpen(true)}
            onOpenWorkoutEdit={() => setWorkoutEditOpen(true)}
            onToggle={makeToggle(rounds, 'rounds')}
            onReset={rounds.reset}
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

      <IosAudioTip open={iosAudioTip} onClose={() => setIosAudioTip(false)} />

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
            if (tab === 'rounds') {
              rounds.reset()
              setRoundsSettings(next as RoundsSettings)
              return
            }
            tabata.reset()
            setTabataSettings(next as TabataSettings)
          }}
        />
      ) : null}
    </div>
  )
}
