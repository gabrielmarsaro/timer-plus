import { openYoutubeExternally, youtubeEmbedUrl, type YoutubeTabataTrack } from '../lib/youtubeTabata'

interface YoutubeMusicDockProps {
  track: YoutubeTabataTrack
  /** Reinicia o iframe com autoplay após gesto do usuário (INICIAR). */
  autoplayKey: number
  onClose: () => void
}

export function YoutubeMusicDock({ track, autoplayKey, onClose }: YoutubeMusicDockProps) {
  const src = youtubeEmbedUrl(track.videoId, autoplayKey > 0)

  return (
    <div className="yt-dock" role="region" aria-label="Música YouTube Tabata">
      <div className="yt-dock-bar">
        <div className="yt-dock-meta">
          <strong>YOUTUBE</strong>
          <span>{track.label}</span>
        </div>
        <div className="yt-dock-actions">
          <button
            type="button"
            className="yt-dock-btn"
            onClick={() => openYoutubeExternally(track.videoId)}
          >
            APP
          </button>
          <button type="button" className="yt-dock-btn" onClick={onClose} aria-label="Fechar player">
            ✕
          </button>
        </div>
      </div>
      <div className="yt-dock-frame">
        <iframe
          key={`${track.videoId}-${autoplayKey}`}
          title={track.label}
          src={src}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
        />
      </div>
    </div>
  )
}
