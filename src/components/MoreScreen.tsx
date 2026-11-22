interface MoreScreenProps {
  onOpenGeneralSettings: () => void
  onGoTabata: () => void
  onGoRounds: () => void
  onGoStopwatch: () => void
}

const APK_URL =
  'https://github.com/gabrielmarsaro/timer-plus/raw/main/releases/timer-plus-debug.apk'

export function MoreScreen({
  onOpenGeneralSettings,
  onGoTabata,
  onGoRounds,
  onGoStopwatch,
}: MoreScreenProps) {
  return (
    <section className="more-screen">
      <header className="more-header">
        <h1>MAIS</h1>
        <p>Atalhos, instalação e dicas</p>
      </header>

      <div className="more-body">
        <button type="button" className="more-card" onClick={onOpenGeneralSettings}>
          <span className="more-card-title">CONFIGURAÇÕES</span>
          <span className="more-card-desc">Som, voz, vibração e formato de tempo</span>
        </button>

        <div className="more-section-label">MODOS</div>
        <button type="button" className="more-row" onClick={onGoTabata}>
          <span>TABATA</span>
          <span className="more-chevron">›</span>
        </button>
        <button type="button" className="more-row" onClick={onGoRounds}>
          <span>RONDAS</span>
          <span className="more-chevron">›</span>
        </button>
        <button type="button" className="more-row" onClick={onGoStopwatch}>
          <span>CRONÓMETRO</span>
          <span className="more-chevron">›</span>
        </button>

        <div className="more-section-label">INSTALAR</div>
        <a className="more-row more-link" href={APK_URL}>
          <span>BAIXAR APK ANDROID</span>
          <span className="more-chevron">›</span>
        </a>
        <div className="more-note">
          No iPhone: Safari → Compartilhar → Adicionar à Tela de Início. Desative o mute lateral
          para ouvir sons.
        </div>

        <div className="more-section-label">DICAS</div>
        <ul className="more-tips">
          <li>No Tabata/Rondas, o exercício e o descanso ficam em destaque no centro.</li>
          <li>Com Spotify/Deezer/YouTube tocando, o tic-tac cala e só restam alertas de início/fim.</li>
          <li>No cronómetro, use VOLTA para marcar intervalos durante a corrida.</li>
        </ul>
      </div>
    </section>
  )
}
