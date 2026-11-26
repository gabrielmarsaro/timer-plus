import { isAppleTouchWeb } from '../lib/feedback'

const APK_URL =
  'https://github.com/gabrielmarsaro/timer-plus/raw/main/releases/timer-plus-debug.apk'

interface FirstRunCoachProps {
  open: boolean
  onClose: () => void
}

export function FirstRunCoach({ open, onClose }: FirstRunCoachProps) {
  if (!open) return null

  const apple = isAppleTouchWeb()

  return (
    <div className="coach-overlay" role="dialog" aria-modal="true" aria-labelledby="coach-title">
      <div className="coach-card">
        <p className="brand-mark">TIMER VIKING</p>
        <h2 id="coach-title">BEM-VINDO</h2>
        <p className="coach-intro">
          Timer de Tabata, rondas e cronómetro. Três dicas rápidas para funcionar bem no telemóvel:
        </p>
        <ol className="coach-list">
          {apple ? (
            <>
              <li>
                Desative o <strong>mute lateral</strong> e aumente o volume para ouvir alertas.
              </li>
              <li>
                Safari → <strong>Compartilhar</strong> → <strong>Adicionar à Tela de Início</strong>{' '}
                para usar como app.
              </li>
              <li>
                Com o timer a correr, o tempo aparece em <strong>A reproduzir</strong> na tela
                bloqueada.
              </li>
            </>
          ) : (
            <>
              <li>
                Instale o APK Android para treinar offline (atualizações em{' '}
                <strong>Mais</strong>).
              </li>
              <li>
                Ao iniciar, o tempo pode aparecer na <strong>tela bloqueada</strong> / notificação.
              </li>
              <li>
                No treino: use <strong>+15s</strong> ou <strong>PULAR</strong> se errar um round.
              </li>
            </>
          )}
        </ol>
        {!apple ? (
          <a className="coach-apk" href={APK_URL}>
            BAIXAR APK ANDROID
          </a>
        ) : null}
        <button type="button" className="coach-done" onClick={onClose}>
          COMEÇAR
        </button>
      </div>
    </div>
  )
}
