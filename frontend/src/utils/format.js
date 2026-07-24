export const ratingText = (value) => value == null ? 'Not yet rated' : `${Number(value).toFixed(1)}`
export const formatDate = (value) => new Intl.DateTimeFormat('en', { year: 'numeric', month: 'short', day: 'numeric' }).format(new Date(value))
export const placePath = (place) => `/places/${place.id}/${encodeURIComponent(place.slug)}`
export const fieldError = (errors, name) => {
  const value = errors?.[name]
  return Array.isArray(value) ? value.join(' ') : value || ''
}
