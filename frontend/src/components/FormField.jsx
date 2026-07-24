import { fieldError } from '../utils/format'

export default function FormField({ label, name, errors, hint, children, required = false }) {
  const error = fieldError(errors, name)
  return <div className="form-field">
    <label htmlFor={name}>{label}{!required && <span> optional</span>}</label>
    {children}
    {hint && <small>{hint}</small>}
    {error && <p className="field-error" id={`${name}-error`}>{error}</p>}
  </div>
}
