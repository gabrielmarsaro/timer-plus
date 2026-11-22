import { Capacitor } from '@capacitor/core'

export interface YoutubeTabataTrack {
  id: string
  label: string
  /** YouTube video id (watch?v=) */
  videoId: string
  blurb: string
}

/**
 * Faixas públicas no YouTube (links oficiais).
 * Não baixamos nem embutimos o áudio no APK — só abrimos/embedamos o player do YouTube.
 */
export const YOUTUBE_TABATA_TRACKS: YoutubeTabataTrack[] = [
  {
    id: 'songs20',
    label: 'TABATA SONGS 20 MIN',
    videoId: '14JwZ97rhkI',
    blurb: 'Compilação de músicas Tabata com timer',
  },
  {
    id: 'abs20',
    label: 'TABATA ABS 20 MIN',
    videoId: 'aTvIBZWkxWY',
    blurb: 'Treino Tabata com música e cues',
  },
  {
    id: 'hiphop25',
    label: 'HIP-HOP TABATA 25',
    videoId: 'SJ6f2TnHZBc',
    blurb: 'POPSUGAR — hip-hop Tabata',
  },
  {
    id: 'tabata20',
    label: 'TABATA WORKOUT 20',
    videoId: 'sHgLdjyhbdA',
    blurb: 'Treino Tabata guiado com trilha',
  },
]

export function getYoutubeTrack(id: string | undefined): YoutubeTabataTrack {
  return (
    YOUTUBE_TABATA_TRACKS.find((track) => track.id === id) ?? YOUTUBE_TABATA_TRACKS[0]!
  )
}

export function youtubeWatchUrl(videoId: string): string {
  return `https://www.youtube.com/watch?v=${videoId}`
}

export function youtubeEmbedUrl(videoId: string, autoplay: boolean): string {
  const params = new URLSearchParams({
    playsinline: '1',
    rel: '0',
    modestbranding: '1',
    autoplay: autoplay ? '1' : '0',
  })
  return `https://www.youtube.com/embed/${videoId}?${params.toString()}`
}

/** Abre o vídeo no app/site do YouTube (fora do timer). */
export function openYoutubeExternally(videoId: string): void {
  const https = youtubeWatchUrl(videoId)
  try {
    if (Capacitor.isNativePlatform()) {
      window.open(https, '_blank')
      return
    }
    window.open(https, '_blank', 'noopener,noreferrer')
  } catch {
    window.location.href = https
  }
}
