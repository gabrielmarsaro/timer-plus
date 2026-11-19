import { useEffect, useMemo, useRef } from 'react'

const ITEM_HEIGHT = 40
const VISIBLE = 5

interface WheelPickerProps {
  values: number[]
  value: number
  format?: (value: number) => string
  ariaLabel: string
  onChange: (value: number) => void
}

export function WheelPicker({
  values,
  value,
  format = String,
  ariaLabel,
  onChange,
}: WheelPickerProps) {
  const scrollerRef = useRef<HTMLDivElement>(null)
  const frameRef = useRef(0)
  const padding = ((VISIBLE - 1) / 2) * ITEM_HEIGHT

  const index = useMemo(() => {
    const found = values.indexOf(value)
    if (found >= 0) return found
    let closest = 0
    let best = Number.POSITIVE_INFINITY
    values.forEach((item, i) => {
      const distance = Math.abs(item - value)
      if (distance < best) {
        best = distance
        closest = i
      }
    })
    return closest
  }, [value, values])

  useEffect(() => {
    const node = scrollerRef.current
    if (!node) return
    const top = index * ITEM_HEIGHT
    if (Math.abs(node.scrollTop - top) > 1) {
      node.scrollTop = top
    }
  }, [index])

  const emitNearest = () => {
    const node = scrollerRef.current
    if (!node) return
    const nearest = Math.round(node.scrollTop / ITEM_HEIGHT)
    const clamped = Math.max(0, Math.min(values.length - 1, nearest))
    const next = values[clamped]
    if (next !== undefined && next !== value) onChange(next)
    node.scrollTo({ top: clamped * ITEM_HEIGHT, behavior: 'smooth' })
  }

  return (
    <div className="wheel" style={{ height: VISIBLE * ITEM_HEIGHT }}>
      <div className="wheel-highlight" aria-hidden />
      <div
        ref={scrollerRef}
        className="wheel-scroller"
        role="listbox"
        aria-label={ariaLabel}
        aria-activedescendant={`wheel-${ariaLabel}-${value}`}
        tabIndex={0}
        onScroll={() => {
          cancelAnimationFrame(frameRef.current)
          frameRef.current = requestAnimationFrame(() => {
            const node = scrollerRef.current
            if (!node) return
            const nearest = Math.round(node.scrollTop / ITEM_HEIGHT)
            const clamped = Math.max(0, Math.min(values.length - 1, nearest))
            const next = values[clamped]
            if (next !== undefined && next !== value) onChange(next)
          })
        }}
        onTouchEnd={emitNearest}
        onMouseUp={emitNearest}
        onKeyDown={(event) => {
          if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
            event.preventDefault()
            const delta = event.key === 'ArrowUp' ? -1 : 1
            const nextIndex = Math.max(0, Math.min(values.length - 1, index + delta))
            onChange(values[nextIndex])
          }
        }}
      >
        <div style={{ height: padding }} />
        {values.map((item) => (
          <div
            key={item}
            id={`wheel-${ariaLabel}-${item}`}
            role="option"
            aria-selected={item === value}
            className={`wheel-item${item === value ? ' is-active' : ''}`}
            style={{ height: ITEM_HEIGHT }}
          >
            {format(item)}
          </div>
        ))}
        <div style={{ height: padding }} />
      </div>
    </div>
  )
}

interface DurationWheelProps {
  value: number
  min: number
  max: number
  step: number
  label: string
  onChange: (value: number) => void
}

export function DurationWheel({ value, min, max, step, label, onChange }: DurationWheelProps) {
  const maxMinutes = Math.floor(max / 60)
  const minutes = Math.floor(value / 60)
  const seconds = value % 60

  const minuteValues = useMemo(
    () => Array.from({ length: maxMinutes + 1 }, (_, i) => i),
    [maxMinutes],
  )

  const secondValues = useMemo(() => {
    const list: number[] = []
    for (let s = 0; s < 60; s += step <= 5 ? step : 1) list.push(s)
    if (!list.includes(seconds)) list.push(seconds)
    return list.sort((a, b) => a - b)
  }, [seconds, step])

  const setDuration = (nextMinutes: number, nextSeconds: number) => {
    let next = nextMinutes * 60 + nextSeconds
    next = Math.max(min, Math.min(max, next))
    onChange(next)
  }

  return (
    <div className="duration-wheel" aria-label={label}>
      <WheelPicker
        values={minuteValues}
        value={minutes}
        ariaLabel={`${label} minutos`}
        format={(item) => `${item} min`}
        onChange={(nextMinutes) => setDuration(nextMinutes, seconds)}
      />
      <WheelPicker
        values={secondValues}
        value={seconds}
        ariaLabel={`${label} segundos`}
        format={(item) => `${String(item).padStart(2, '0')} s`}
        onChange={(nextSeconds) => setDuration(minutes, nextSeconds)}
      />
    </div>
  )
}

interface CountWheelProps {
  value: number
  min: number
  max: number
  step?: number
  label: string
  onChange: (value: number) => void
}

export function CountWheel({ value, min, max, step = 1, label, onChange }: CountWheelProps) {
  const values = useMemo(() => {
    const list: number[] = []
    for (let n = min; n <= max; n += step) list.push(n)
    return list
  }, [max, min, step])

  return (
    <WheelPicker
      values={values}
      value={value}
      ariaLabel={label}
      onChange={onChange}
    />
  )
}
