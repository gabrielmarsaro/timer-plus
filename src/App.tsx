import { Capacitor } from '@capacitor/core'
import { StatusBar, Style } from '@capacitor/status-bar'
import { useEffect, useState } from 'react'
import { BottomNav } from './components/BottomNav'
import { PlaceholderScreen } from './components/PlaceholderScreen'
import { SettingsModal } from './components/SettingsModal'
import { TabataScreen } from './components/TabataScreen'
import { useTabataTimer } from './hooks/useTabataTimer'
import { useWakeLock } from './hooks/useWakeLock'
import { DEFAULT_SETTINGS, type Tab, type TabataSettings } from './types'

const STORAGE_KEY = 'timer-plus:tabata-settings'

function loadSettings(): TabataSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_SETTINGS
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) }
  } catch {
    return DEFAULT_SETTINGS
  }
}

export default function App() {
  const [tab, setTab] = useState<Tab>('tabata')
  const [settings, setSettings] = useState<TabataSettings>(loadSettings)
  const [settingsOpen, setSettingsOpen] = useState(false)

  const timer = useTabataTimer(settings)
  useWakeLock(timer.status === 'running')

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
  }, [settings])

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return

    void StatusBar.setStyle({ style: Style.Dark })
    void StatusBar.setBackgroundColor({ color: '#000000' })
  }, [])

  const handleToggle = () => {
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
            status={timer.status}
            currentPhase={timer.currentPhase}
            nextPhase={timer.nextPhase}
            phaseRemaining={
              timer.status === 'idle' ? settings.prepare : timer.phaseRemaining
            }
            totalRemaining={timer.totalRemaining}
            roundsLeft={timer.roundsLeft}
            cyclesLeft={timer.cyclesLeft}
            idleWorkDuration={settings.work}
            onOpenSettings={() => setSettingsOpen(true)}
            onToggle={handleToggle}
            onReset={timer.reset}
          />
        )}

        {tab === 'rounds' && (
          <PlaceholderScreen
            title="Rondas"
            description="Timer de rondas (boxe/MMA) chega na próxima versão."
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
        settings={settings}
        onClose={() => setSettingsOpen(false)}
        onSave={(next) => {
          timer.reset()
          setSettings(next)
        }}
      />
    </div>
  )
}
