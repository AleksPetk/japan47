import { useEffect, useId, useRef } from 'react'

export default function Modal({ title, children, onClose, actions }) {
  const dialog = useRef(null)
  const closeButton = useRef(null)
  const onCloseRef = useRef(onClose)
  const titleId = useId()

  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  useEffect(() => {
    const previousFocus = document.activeElement
    closeButton.current?.focus()
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onCloseRef.current()
      if (event.key !== 'Tab') return
      const focusable = dialog.current?.querySelectorAll(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      )
      if (!focusable?.length) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      previousFocus?.focus?.()
    }
  }, [])

  return <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
    <section ref={dialog} className="modal" role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <header>
        <div><p className="eyebrow">Final check</p><h2 id={titleId}>{title}</h2></div>
        <button ref={closeButton} className="modal__close" type="button" onClick={onClose} aria-label="Close confirmation">×</button>
      </header>
      <div className="modal__body">{children}</div>
      <footer className="modal__actions">{actions}</footer>
    </section>
  </div>
}
