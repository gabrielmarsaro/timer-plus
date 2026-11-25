interface IosAudioTipProps {
  open: boolean
  onClose: () => void
}

export function IosAudioTip({ open, onClose }: IosAudioTipProps) {
  if (!open) return null

  return (
    <div className="ios-audio-tip" role="status">
      <p>
        No iPhone: com o timer a correr, o tempo aparece em <strong>A reproduzir</strong> na
        tela bloqueada. Se os alertas não soarem, desative o <strong>mute lateral</strong>.
      </p>
      <button type="button" className="ios-audio-tip-ok" onClick={onClose}>
        OK
      </button>
    </div>
  )
}
