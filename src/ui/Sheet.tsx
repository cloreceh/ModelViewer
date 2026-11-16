import {
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
} from 'react'

interface Props {
  title: string
  subtitle?: ReactNode
  aside?: ReactNode // right side of the title row (the run on 04)
  onClose: () => void
  children: ReactNode
}

// How far the sheet has to be pulled down before letting go closes it.
const CLOSE_DISTANCE = 80

// The shared bottom sheet (Weeks 3 to 7): a modal dialog named by its
// title. Focus moves to the title, stays inside, and goes back to the
// control that opened it. Closes by swiping down, tapping the dimmed map,
// Escape, or the handle (a "Close" button with a 44 px tap area). Slides
// up, or fades with reduced motion (theme.css shortens the animation).
export function Sheet({ title, subtitle, aside, onClose, children }: Props) {
  const titleId = useId()
  const sheetRef = useRef<HTMLDivElement>(null)
  const titleRef = useRef<HTMLHeadingElement>(null)
  const [drag, setDrag] = useState<{ startY: number; dy: number }>()

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null
    titleRef.current?.focus()
    return () => {
      // Back to the run label, product menu or legend that opened it.
      if (opener && document.contains(opener)) opener.focus()
    }
  }, [])

  // Keep Tab and Shift+Tab inside the sheet; Escape closes it.
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') {
      e.stopPropagation()
      onClose()
      return
    }
    if (e.key !== 'Tab' || !sheetRef.current) return
    const focusable = sheetRef.current.querySelectorAll<HTMLElement>(
      'button:not([disabled]), a[href], input, [tabindex]:not([tabindex="-1"])',
    )
    if (focusable.length === 0) return
    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault()
      last.focus()
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault()
      first.focus()
    }
  }

  // Swipe down on the handle and title to close.
  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    setDrag({ startY: e.clientY, dy: 0 })
  }
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!drag) return
    const dy = Math.max(0, e.clientY - drag.startY)
    // Only take over the pointer once it's clearly a pull, so a tap on
    // the handle still reaches its button.
    if (dy > 4 && !e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.setPointerCapture(e.pointerId)
    }
    setDrag({ ...drag, dy })
  }
  const onPointerUp = () => {
    if (drag && drag.dy > CLOSE_DISTANCE) onClose()
    setDrag(undefined)
  }

  return (
    <div className="sheet-layer">
      {/* The dimmed map: tap to close (not a stop for screen readers,
          which have the Close button). */}
      <div className="sheet-scrim" onClick={onClose} aria-hidden />
      <div
        ref={sheetRef}
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onKeyDown={onKeyDown}
        style={
          drag?.dy
            ? { transform: `translateY(${drag.dy}px)`, transition: 'none' }
            : undefined
        }
      >
        <div
          className="sheet-header"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={() => setDrag(undefined)}
        >
          <button
            type="button"
            className="sheet-handle"
            aria-label="Close"
            onClick={onClose}
          >
            <span aria-hidden />
          </button>
          <div className="sheet-title-row">
            <h2
              id={titleId}
              ref={titleRef}
              className="sheet-title t-heading"
              tabIndex={-1}
            >
              {title}
            </h2>
            {aside}
          </div>
          {subtitle && <p className="sheet-subtitle t-callout">{subtitle}</p>}
        </div>
        <div className="sheet-body">{children}</div>
      </div>
    </div>
  )
}
