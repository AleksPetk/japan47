import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function SiteLayout() {
  const [open, setOpen] = useState(false)
  const { user, logout } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  useEffect(() => {
    const section = location.pathname.split('/').filter(Boolean)[0]
    const labels = { regions: 'Regions', prefectures: 'Prefectures', places: 'Places', search: 'Search', contributors: 'Contributor', 'my-travel': 'My travel', contact: 'Contact', login: 'Login', register: 'Register', 'check-email': 'Check your email', 'verify-email': 'Verify email', 'forgot-password': 'Forgot password', 'reset-password': 'Reset password', privacy: 'Privacy', terms: 'Terms' }
    document.title = section ? `${labels[section] || 'Japan 47'} — Japan 47` : 'Japan 47 — Discover every prefecture'
    const canonical = document.querySelector('link[rel="canonical"]')
    if (canonical) canonical.href = `${window.location.origin}${location.pathname}`
    const description = document.querySelector('meta[name="description"]')
    if (description) description.content = section
      ? `Explore Japan 47 ${labels[section] || section} travel guides and community recommendations.`
      : 'Discover destinations across all 47 Japanese prefectures with community travel guides and reviews.'
    let structuredData = document.querySelector('#japan47-structured-data')
    if (!structuredData) {
      structuredData = document.createElement('script')
      structuredData.id = 'japan47-structured-data'
      structuredData.type = 'application/ld+json'
      document.head.appendChild(structuredData)
    }
    structuredData.textContent = JSON.stringify({ '@context': 'https://schema.org', '@type': 'WebSite', name: 'Japan 47', url: window.location.origin, potentialAction: { '@type': 'SearchAction', target: `${window.location.origin}/search?q={search_term_string}`, 'query-input': 'required name=search_term_string' } })
  }, [location.pathname])
  const close = () => setOpen(false)
  const handleLogout = async () => {
    close()
    try {
      await logout()
    } catch {
      // AuthContext clears local credentials even if token revocation cannot
      // reach Django, so logout must still finish from the user's perspective.
    }
    navigate('/', { replace: true })
  }
  return <div className="site-shell">
    <a className="skip-link" href="#main">Skip to content</a>
    <header className="site-header"><Link className="brand" to="/" onClick={close}><img src="/logo.PNG" alt="Japan 47" /></Link>
      <button className="menu-toggle" aria-expanded={open} aria-controls="main-nav" onClick={() => setOpen(!open)}><span /><span /><span /><b className="sr-only">Menu</b></button>
      <nav id="main-nav" className={open ? 'nav nav--open' : 'nav'} aria-label="Main navigation">
        {['Home', 'Regions', 'Prefectures', 'Places'].map((label) => <NavLink key={label} onClick={close} to={label === 'Home' ? '/' : `/${label.toLowerCase()}`}>{label}</NavLink>)}
        <NavLink onClick={close} to="/search">Search</NavLink>
        {user ? <><NavLink onClick={close} to="/my-travel">My travel</NavLink><NavLink className="nav__user" onClick={close} to={`/contributors/${user.id}`}>{user.profile_image_url ? <img src={user.profile_image_url} alt="" /> : <span>{user.display_name[0]}</span>}{user.display_name}</NavLink><button onClick={handleLogout}>Logout</button></> : <><NavLink onClick={close} to="/login">Login</NavLink><NavLink className="nav__accent" onClick={close} to="/register">Register</NavLink></>}
      </nav>
    </header>
    <main id="main"><Outlet /></main>
    <footer><nav aria-label="Support and legal"><Link to="/contact">Contact Us</Link><Link to="/privacy">Privacy Policy</Link><Link to="/terms">Terms of Use</Link></nav><p>© {new Date().getFullYear()} Japan 47. All rights reserved.</p><small>Created by Aleks Petk</small></footer>
  </div>
}
