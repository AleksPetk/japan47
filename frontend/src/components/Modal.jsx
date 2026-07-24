import { useEffect, useRef } from 'react'

export default function Modal({ title, children, onClose, actions }) {
  const closeButton = useRef(null)

  useEffect(() => {
    const previousFocus = document.activeElement
    closeButton.current?.focus()
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      previousFocus?.focus?.()
    }
  }, [onClose])

  return <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
    <section className="modal" role="dialog" aria-modal="true" aria-labelledby="support-modal-title">
      <header>
        <div><p className="eyebrow">Final check</p><h2 id="support-modal-title">{title}</h2></div>
        <button ref={closeButton} className="modal__close" type="button" onClick={onClose} aria-label="Close confirmation">×</button>
      </header>
      <div className="modal__body">{children}</div>
      <footer className="modal__actions">{actions}</footer>
    </section>
  </div>
}
