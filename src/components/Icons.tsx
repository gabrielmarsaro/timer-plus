import type { SVGProps } from 'react'

type IconProps = SVGProps<SVGSVGElement>

export function GearIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M19.4 13.5a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1 1.55V20a2 2 0 1 1-4 0v-.09a1.7 1.7 0 0 0-1-1.55 1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.7 1.7 0 0 0 .34-1.87 1.7 1.7 0 0 0-1.55-1H4a2 2 0 1 1 0-4h.09a1.7 1.7 0 0 0 1.55-1 1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.7 1.7 0 0 0 1.87.34h.01A1.7 1.7 0 0 0 11 4.09V4a2 2 0 1 1 4 0v.09a1.7 1.7 0 0 0 1 1.55h.01a1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.7 1.7 0 0 0-.34 1.87v.01a1.7 1.7 0 0 0 1.55 1H20a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.51 1Z"
      />
    </svg>
  )
}

export function ResetIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12a7.5 7.5 0 0 1 12.7-5.4L20 9" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M20 4v5h-5" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 12a7.5 7.5 0 0 1-12.7 5.4L4 15" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 20v-5h5" />
    </svg>
  )
}

export function PlayIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M8.5 6.8c0-.9 1-1.5 1.8-1L18 11c.8.5.8 1.6 0 2.1L10.3 18.3c-.8.5-1.8-.1-1.8-1V6.8Z" />
    </svg>
  )
}

export function PauseIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <rect x="6.5" y="5" width="4" height="14" rx="1.2" />
      <rect x="13.5" y="5" width="4" height="14" rx="1.2" />
    </svg>
  )
}

export function SkipIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M5.5 6.7c0-.9 1-1.5 1.8-1L14 11c.8.5.8 1.6 0 2.1L7.3 18.2c-.8.5-1.8-.1-1.8-1V6.7Z" />
      <rect x="16.2" y="5.5" width="2.4" height="13" rx="1" />
    </svg>
  )
}

/** Runa/escudo pequeno para marca Timer Viking. */
export function ForgeMark(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden {...props}>
      <path
        d="M12 2.5 19.5 6v6.2c0 4.4-3.3 7.3-7.5 8.8-4.2-1.5-7.5-4.4-7.5-8.8V6L12 2.5Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path
        d="M12 7.2v5.2l3.2 1.9"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function TabataNavIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
      <circle cx="12" cy="13" r="7" />
      <path strokeLinecap="round" d="M12 10.5v3l2 1.2" />
      <path strokeLinecap="round" d="M9 4h6" />
    </svg>
  )
}

export function RoundsNavIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
      <circle cx="12" cy="12" r="7.5" />
      <path strokeLinecap="round" d="M12 8v4l2.5 1.5" />
      <path strokeLinecap="round" d="M7 5.5 5.5 7" />
      <path strokeLinecap="round" d="M17 5.5 18.5 7" />
    </svg>
  )
}

export function StopwatchNavIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
      <circle cx="12" cy="13" r="7" />
      <circle cx="12" cy="13" r="1.6" fill="currentColor" stroke="none" />
      <path strokeLinecap="round" d="M9 3.8h6" />
      <path strokeLinecap="round" d="M12 3.8V6" />
    </svg>
  )
}

export function MoreNavIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M7 7.5A6 6 0 1 1 5.2 14" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 10.5V7.5H8" />
      <circle cx="12" cy="13.5" r="1.2" fill="currentColor" stroke="none" />
    </svg>
  )
}

export function TimerMiniIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
      <circle cx="12" cy="13" r="6.5" />
      <path strokeLinecap="round" d="M12 10v3.2l2 1" />
      <path strokeLinecap="round" d="M9.5 4.2h5" />
    </svg>
  )
}
