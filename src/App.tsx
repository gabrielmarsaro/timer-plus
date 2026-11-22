import { Capacitor } from '@capacitor/core'
// Capacitor used for native YouTube handoff
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
import { YoutubeMusicDock } from './components/YoutubeMusicDock'
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
import { getYoutubeTrack, openYoutubeExternally } from './lib/youtubeTabata'
import { buildPhases, buildRoundsPhases } from './lib/buildPhases'
import {
  DEFAULT_GENERAL_SETTINGS,
  DEFAULT_ROUNDS_SETTINGS,
  DEFAULT_SETTINGS,
  type GeneralSettings,
  type Phase,
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
    loadJson(TABATA_KEY, DEFAULT_SETTINGS),
  )
  const [roundsSettings, setRoundsSettings] = useState<RoundsSettings>(() =>
    loadJson(ROUNDS_KEY, DEFAULT_ROUNDS_SETTINGS),
  )
  const [generalSettings, setGeneralSettings] = useState<GeneralSettings>(() =>
    loadJson(GENERAL_KEY, DEFAULT_GENERAL_SETTINGS),
  )
  const [generalOpen, setGeneralOpen] = useState(false)
  const [workoutEditOpen, setWorkoutEditOpen] = useState(false)
  const [screenFlash, setScreenFlash] = useState(false)
  const [iosAudioTip, setIosAudioTip] = useState(false)
  const [youtubeDockOpen, setYoutubeDockOpen] = useState(false)
  const [youtubeAutoplayKey, setYoutubeAutoplayKey] = useState(0)

  const flashScreen = useCallback(() => {
    if (!generalSettings.screenFlash) return
    setScreenFlash(true)
    window.setTimeout(() => setScreenFlash(false), 160)
  }, [generalSettings.screenFlash])

  const handlePhaseEvent = useCallback(
    (phase: Phase, next: Phase | null) => {
      flashScreen()
      feedbackPhaseStart(phase, next)
    },
    [flashScreen],
  )

  const handleSecond = useCallback(
    (remaining: number, phase: Phase) => {
      const warning =
        tab === 'rounds'
          ? roundsSettings.warning
          : phase.kind === 'work'
            ? 10
            : 0
      onCountdownSecond(remaining, phase, warning)
    },
    [roundsSettings.warning, tab],
  )

  const tabataPhases = useMemo(() => buildPhases(tabataSettings), [tabataSettings])
  const roundsPhases = useMemo(() => buildRoundsPhases(roundsSettings), [roundsSettings])

  const tabata = usePhaseTimer(tabataPhases, {
    totalRounds: tabataSettings.rounds,
    totalCycles: tabataSettings.cycles,
    onStart: handlePhaseEvent,
    onPhaseChange: handlePhaseEvent,
    onSecond: handleSecond,
    onComplete: () => {
      flashScreen()
      announceDone()
    },
  })

  const rounds = usePhaseTimer(roundsPhases, {
    totalRounds: roundsSettings.rounds,
    totalCycles: 1,
    onStart: handlePhaseEvent,
    onPhaseChange: handlePhaseEvent,
    onSecond: handleSecond,
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

  useEffect(() => {
    const timer = tab === 'rounds' ? rounds : tabata
    const phase = tab === 'stopwatch' || tab === 'more' ? null : timer.currentPhase
    const running =
      tab === 'tabata'
        ? tabata.status === 'running'
        : tab === 'rounds'
          ? rounds.status === 'running'
          : false
    syncWorkoutMusic(phase, running)
    if (!running && (tab === 'tabata' || tab === 'rounds')) {
      if (timer.status === 'paused') pauseWorkoutMusic()
      if (timer.status === 'idle') stopWorkoutMusic()
    }
  }, [
    tab,
    tabata.status,
    tabata.currentPhase,
    rounds.status,
    rounds.currentPhase,
  ])

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

  const armYoutubeDock = () => {
    if (generalSettings.workoutMusicMode !== 'youtube') {
      setYoutubeDockOpen(false)
      return
    }
    setYoutubeDockOpen(true)
    setYoutubeAutoplayKey((key) => key + 1)
    // Android APK: open the real YouTube app so the track always plays
    // (in-app iframe can be blocked by YouTube bot checks).
    if (Capacitor.isNativePlatform()) {
      openYoutubeExternally(getYoutubeTrack(generalSettings.youtubeTrackId).videoId)
    }
  }

  const makeToggle =
    (timer: typeof tabata) =>
    () => {
      unlockFeedback()

      if (timer.status === 'running') {
        pauseWorkoutMusic()
        timer.pause()
        return
      }
      if (timer.status === 'paused') {
        armYoutubeDock()
        void timer.resume()
        return
      }
      maybeShowIosTip()
      armYoutubeDock()
      void timer.start()
    }

  const toggleStopwatch = () => {
    unlockFeedback()
    if (stopwatch.status === 'running') {
      stopwatch.pause()
      return
    }
    if (stopwatch.status === 'paused') {
      stopwatch.resume()
      return
    }
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

  const youtubeTrack = getYoutubeTrack(generalSettings.youtubeTrackId)
  const showYoutubeDock =
    youtubeDockOpen &&
    generalSettings.workoutMusicMode === 'youtube' &&
    (tab === 'tabata' || tab === 'rounds') &&
    (tab === 'tabata' ? tabata.status !== 'idle' : rounds.status !== 'idle')

  return (
    <div
      className={`app-shell${screenFlash ? ' is-flashing' : ''}${
        generalSettings.lightColors ? ' theme-light' : ''
      }${timerLive ? ' is-timer-live' : ''}${showYoutubeDock ? ' has-yt-dock' : ''}`}
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
            onToggle={makeToggle(tabata)}
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
            onToggle={makeToggle(rounds)}
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
            onGoTabata={() => setTab('tabata')}
            onGoRounds={() => setTab('rounds')}
            onGoStopwatch={() => setTab('stopwatch')}
          />
        )}
      </main>

      {showYoutubeDock ? (
        <YoutubeMusicDock
          track={youtubeTrack}
          autoplayKey={youtubeAutoplayKey}
          onClose={() => setYoutubeDockOpen(false)}
        />
      ) : null}

      <BottomNav active={tab} onChange={setTab} />

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
