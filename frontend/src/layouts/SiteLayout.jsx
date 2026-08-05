import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import SEO from '../components/SEO'
import { useAuth } from '../context/AuthContext'
import { getRouteMetadata } from '../utils/seo'

export default function SiteLayout() {
  const [open, setOpen] = useState(false)
  const { user, logout, clearAuth } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const routeMetadata = getRouteMetadata(location.pathname)
  useEffect(() => {
    // Account deletion navigates to this public route before clearing the
    // context, preventing the old protected route from redirecting to login.
    if (location.state?.accountDeleted) clearAuth()
  }, [clearAuth, location.state?.accountDeleted])
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
  return (
    <>
      <SEO {...routeMetadata} />
      <div className="site-shell">
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        <header className="site-header">
          <Link className="brand" to="/" onClick={close}>
            <img src="/logo.webp" alt="Japan 47" width="308" height="206" />
          </Link>
          <button
            className="menu-toggle"
            aria-expanded={open}
            aria-controls="main-nav"
            onClick={() => setOpen(!open)}
          >
            <span />
            <span />
            <span />
            <b className="sr-only">Menu</b>
          </button>
          <nav
            id="main-nav"
            className={open ? 'nav nav--open' : 'nav'}
            aria-label="Main navigation"
          >
            {['Home', 'Regions', 'Prefectures', 'Places'].map((label) => (
              <NavLink
                key={label}
                onClick={close}
                to={label === 'Home' ? '/' : `/${label.toLowerCase()}`}
              >
                {label}
              </NavLink>
            ))}
            <NavLink onClick={close} to="/search">
              Search
            </NavLink>
            {user ? (
              <>
                <NavLink onClick={close} to="/my-travel">
                  My travel
                </NavLink>
                <NavLink className="nav__user" onClick={close} to={`/contributors/${user.id}`}>
                  {user.profile_image_url ? (
                    <img src={user.profile_image_url} alt="" />
                  ) : (
                    <span>{user.display_name[0]}</span>
                  )}
                  {user.display_name}
                </NavLink>
                <button onClick={handleLogout}>Logout</button>
              </>
            ) : (
              <>
                <NavLink onClick={close} to="/login">
                  Login
                </NavLink>
                <NavLink className="nav__accent" onClick={close} to="/register">
                  Register
                </NavLink>
              </>
            )}
          </nav>
        </header>
        {location.state?.successMessage && (
          <div className="site-notice" role="status">
            {location.state.successMessage}
          </div>
        )}
        <main id="main">
          <Outlet />
        </main>
        <footer>
          <nav aria-label="Support and legal">
            <Link to="/contact">Contact Us</Link>
            <Link to="/support">Support Japan47</Link>
            <Link to="/privacy">Privacy Policy</Link>
            <Link to="/terms">Terms of Use</Link>
          </nav>
          <p>© {new Date().getFullYear()} Japan 47. All rights reserved.</p>
          <small>Created by Aleks Petk</small>
        </footer>
      </div>
    </>
  )
}
