import { Capacitor } from '@capacitor/core'
import { StatusBar, Style } from '@capacitor/status-bar'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { BottomNav } from './components/BottomNav'
import { GeneralSettingsModal } from './components/GeneralSettingsModal'
import { PlaceholderScreen } from './components/PlaceholderScreen'
import { RoundsScreen } from './components/RoundsScreen'
import { TabataScreen } from './components/TabataScreen'
import { WorkoutEditModal } from './components/WorkoutEditModal'
import { usePhaseTimer } from './hooks/usePhaseTimer'
import { useWakeLock } from './hooks/useWakeLock'
import {
  announceDone,
  configureFeedback,
  feedbackPhaseStart,
  onCountdownSecond,
  unlockFeedback,
} from './lib/feedback'
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

  const activeRunning =
    (tab === 'tabata' && tabata.status === 'running') ||
    (tab === 'rounds' && rounds.status === 'running')

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
    if (!Capacitor.isNativePlatform()) return
    void StatusBar.setStyle({
      style: generalSettings.lightColors ? Style.Light : Style.Dark,
    })
    void StatusBar.setBackgroundColor({
      color: generalSettings.lightColors ? '#f4f4f4' : '#000000',
    })
  }, [generalSettings.lightColors])

  const makeToggle =
    (timer: typeof tabata) =>
    async () => {
      await unlockFeedback()
      if (timer.status === 'running') {
        timer.pause()
        return
      }
      if (timer.status === 'paused') {
        await timer.resume()
        return
      }
      await timer.start()
    }

  return (
    <div
      className={`app-shell${screenFlash ? ' is-flashing' : ''}${
        generalSettings.lightColors ? ' theme-light' : ''
      }`}
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
            onToggle={() => void makeToggle(tabata)()}
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
            onToggle={() => void makeToggle(rounds)()}
            onReset={rounds.reset}
          />
        )}

        {tab === 'stopwatch' && (
          <PlaceholderScreen
            title="Cronómetro"
            description="Cronómetro com intervalos chega na próxima versão."
          />
        )}

        {tab === 'more' && (
          <PlaceholderScreen
            title="Mais"
            description="Histórico, templates e opções extras em breve."
          />
        )}
      </main>

      <BottomNav active={tab} onChange={setTab} />

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
