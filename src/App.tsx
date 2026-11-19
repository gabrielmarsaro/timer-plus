import { Capacitor } from '@capacitor/core'
import { StatusBar, Style } from '@capacitor/status-bar'
import { useEffect, useMemo, useState } from 'react'
import { BottomNav } from './components/BottomNav'
import { GeneralSettingsModal } from './components/GeneralSettingsModal'
import { PlaceholderScreen } from './components/PlaceholderScreen'
import { RoundsScreen } from './components/RoundsScreen'
import { TabataScreen } from './components/TabataScreen'
import { WorkoutEditModal } from './components/WorkoutEditModal'
import { usePhaseTimer } from './hooks/usePhaseTimer'
import { useWakeLock } from './hooks/useWakeLock'
import { setAudioPreferences } from './lib/beep'
import { buildPhases, buildRoundsPhases } from './lib/buildPhases'
import {
  DEFAULT_GENERAL_SETTINGS,
  DEFAULT_ROUNDS_SETTINGS,
  DEFAULT_SETTINGS,
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

  const tabataPhases = useMemo(() => buildPhases(tabataSettings), [tabataSettings])
  const roundsPhases = useMemo(() => buildRoundsPhases(roundsSettings), [roundsSettings])

  const tabata = usePhaseTimer(tabataPhases, {
    totalRounds: tabataSettings.rounds,
    totalCycles: tabataSettings.cycles,
  })
  const rounds = usePhaseTimer(roundsPhases, {
    totalRounds: roundsSettings.rounds,
    totalCycles: 1,
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
    setAudioPreferences({
      soundEffect: generalSettings.soundEffect,
      volume: generalSettings.volume,
      vibration: generalSettings.vibration,
      ticking: generalSettings.ticking,
    })
    document.documentElement.dataset.lightColors = generalSettings.lightColors
      ? 'true'
      : 'false'
    document.documentElement.dataset.allowRotation = generalSettings.rotation
      ? 'true'
      : 'false'
  }, [generalSettings])

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return
    void StatusBar.setStyle({ style: Style.Dark })
    void StatusBar.setBackgroundColor({ color: '#000000' })
  }, [])

  // Screen flash on phase change
  const phaseKey =
    tab === 'rounds'
      ? `${rounds.status}-${rounds.currentPhase?.label}-${Math.ceil(rounds.phaseRemaining)}`
      : `${tabata.status}-${tabata.currentPhase?.label}-${Math.ceil(tabata.phaseRemaining)}`

  useEffect(() => {
    if (!generalSettings.screenFlash) return
    const timer = tab === 'rounds' ? rounds : tabata
    if (timer.status !== 'running') return
    if (timer.phaseRemaining > (timer.currentPhase?.duration ?? 0) - 0.25) {
      setScreenFlash(true)
      const id = window.setTimeout(() => setScreenFlash(false), 180)
      return () => window.clearTimeout(id)
    }
  }, [phaseKey, generalSettings.screenFlash, rounds, tab, tabata])

  const makeToggle =
    (timer: typeof tabata) =>
    () => {
      if (timer.status === 'running') {
        timer.pause()
        return
      }
      if (timer.status === 'paused') {
        void timer.resume()
        return
      }
      void timer.start()
    }

  return (
    <div className={`app-shell${screenFlash ? ' is-flashing' : ''}`}>
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
            onOpenGeneralSettings={() => setGeneralOpen(true)}
            onOpenWorkoutEdit={() => setWorkoutEditOpen(true)}
            onToggle={makeToggle(rounds)}
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
          onClose={() => setGeneralOpen(false)}
          onSave={setGeneralSettings}
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
