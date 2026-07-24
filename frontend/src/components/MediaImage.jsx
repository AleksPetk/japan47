export default function MediaImage({ src, alt, mark = '旅', className = '', priority = false }) {
  return src
    ? <img className={className} src={src} alt={alt} loading={priority ? 'eager' : 'lazy'} fetchPriority={priority ? 'high' : 'auto'} decoding="async" />
    : <div className={`image-placeholder ${className}`} aria-label={`${alt}: no image available`}><span aria-hidden="true">{mark}</span></div>
}
