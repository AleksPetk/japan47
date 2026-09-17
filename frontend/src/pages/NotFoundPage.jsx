import { Link, useLocation } from 'react-router-dom'
import SEO from '../components/SEO'
import { normalizeCanonicalPath } from '../utils/seo'

export default function NotFoundPage() {
  const location = useLocation()
  return (
    <section className="not-found">
      <SEO
        title="Page Not Found | Japan47"
        description="This Japan47 page may have moved or never existed."
        canonicalPath={normalizeCanonicalPath(location.pathname)}
        robots="noindex, follow"
      />
      <span>四〇四</span>
      <h1>This path has wandered off the map.</h1>
      <p>The page may have moved or never existed.</p>
      <Link className="button button--primary" to="/">
        Return home
      </Link>
    </section>
  )
}
