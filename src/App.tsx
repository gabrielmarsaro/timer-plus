import { Capacitor } from '@capacitor/core'
import { StatusBar, Style } from '@capacitor/status-bar'
import { useEffect, useMemo, useState } from 'react'
import { BottomNav } from './components/BottomNav'
import { PlaceholderScreen } from './components/PlaceholderScreen'
import { RoundsScreen } from './components/RoundsScreen'
import { SettingsModal } from './components/SettingsModal'
import { TabataScreen } from './components/TabataScreen'
import { usePhaseTimer } from './hooks/usePhaseTimer'
import { useWakeLock } from './hooks/useWakeLock'
import { buildPhases, buildRoundsPhases } from './lib/buildPhases'
import {
  DEFAULT_ROUNDS_SETTINGS,
  DEFAULT_SETTINGS,
  type RoundsSettings,
  type Tab,
  type TabataSettings,
} from './types'

const TABATA_KEY = 'timer-plus:tabata-settings'
const ROUNDS_KEY = 'timer-plus:rounds-settings'

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
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [settingsFocus, setSettingsFocus] = useState<string | null>(null)

  const openSettings = (focusKey?: string) => {
    setSettingsFocus(focusKey ?? null)
    setSettingsOpen(true)
  }

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
    if (!Capacitor.isNativePlatform()) return
    void StatusBar.setStyle({ style: Style.Dark })
    void StatusBar.setBackgroundColor({ color: '#000000' })
  }, [])

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
    <div className="app-shell">
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
            onOpenSettings={openSettings}
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
            currentRoundNumber={rounds.currentRoundNumber}
            idlePrepare={roundsSettings.prepare}
            idleRoundDuration={roundsSettings.round}
            idleRestDuration={roundsSettings.rest}
            totalRounds={roundsSettings.rounds}
            onOpenSettings={openSettings}
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

      <SettingsModal
        open={settingsOpen}
        mode={tab === 'rounds' ? 'rounds' : 'tabata'}
        settings={tab === 'rounds' ? roundsSettings : tabataSettings}
        focusKey={settingsFocus}
        onClose={() => {
          setSettingsOpen(false)
          setSettingsFocus(null)
        }}
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
    </div>
  )
}
