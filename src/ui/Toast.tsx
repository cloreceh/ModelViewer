import { useEffect, useRef, useState } from 'react'
import { useToast } from '../state/toast'

// How long a toast stays (Week 7): at least 8 s when it has an action, so
// there's time to reach Undo; 5 s without. It doesn't close while it's
// focused or being touched.
const WITH_ACTION_MS = 8000
const PLAIN_MS = 5000

// The toast sits above the floating legend. Its text is a status message:
// read out without moving focus.
export function Toast() {
  const toast = useToast((s) => s.toast)
  const dismiss = useToast((s) => s.dismiss)
  const [held, setHeld] = useState(false)
  const timer = useRef<number | undefined>(undefined)

  useEffect(() => {
    if (!toast || held) return
    timer.current = window.setTimeout(
      () => dismiss(toast.id),
      toast.action ? WITH_ACTION_MS : PLAIN_MS,
    )
    return () => window.clearTimeout(timer.current)
  }, [toast, held, dismiss])

  return (
    <div className="toast-region" role="status" aria-live="polite">
      {toast && (
        <div
          key={toast.id}
          className="toast"
          onPointerEnter={() => setHeld(true)}
          onPointerLeave={() => setHeld(false)}
          onTouchStart={() => setHeld(true)}
          onTouchEnd={() => setHeld(false)}
          onFocus={() => setHeld(true)}
          onBlur={() => setHeld(false)}
        >
          <span className="toast-message t-callout">{toast.message}</span>
          {toast.action && (
            <button
              type="button"
              className="toast-action t-callout-strong"
              onClick={() => {
                toast.action!.run()
                dismiss(toast.id)
              }}
            >
              {toast.action.label}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
