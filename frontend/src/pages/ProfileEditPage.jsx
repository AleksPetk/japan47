import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import FormField from '../components/FormField'
import { LoadingState } from '../components/AsyncState'
import { useAuth } from '../context/AuthContext'

export default function ProfileEditPage() {
  const { user, loading, reloadUser, logout } = useAuth(); const navigate = useNavigate(); const [values, setValues] = useState(null); const [image, setImage] = useState(null); const [errors, setErrors] = useState({}); const [busy, setBusy] = useState(false)
  if (loading || !user) return <LoadingState />
  const form = values || { nickname: user.nickname, email: user.email }
  const change = (e) => setValues({ ...form, [e.target.name]: e.target.value })
  const submit = async (e) => { e.preventDefault(); setBusy(true); const body = new FormData(); body.append('nickname', form.nickname); body.append('email', form.email); if (image) body.append('profile_image', image); try { const updated = await api('/profile/', { method: 'PATCH', body }); if (!updated.email_verified) { await logout(); navigate('/check-email', { replace: true, state: { email: form.email } }); return } await reloadUser(); navigate(`/contributors/${user.id}`) } catch (err) { setErrors(err.fields || { general: err.message }) } finally { setBusy(false) } }
  return <section className="form-page form-page--small"><div><p className="eyebrow">Your account</p><h1>Edit profile</h1><p>Update how you appear to the Japan 47 community.</p></div><form onSubmit={submit}>{errors.general && <p className="form-error">{errors.general}</p>}<FormField label="Nickname" name="nickname" errors={errors}><input id="nickname" name="nickname" value={form.nickname} onChange={change} maxLength="80" /></FormField><FormField label="Email" name="email" errors={errors} required><input id="email" name="email" type="email" value={form.email} onChange={change} required /></FormField><FormField label="Profile photo" name="profile_image" errors={errors}><input id="profile_image" type="file" accept="image/*,.heic,.heif" onChange={(e) => setImage(e.target.files[0])} /></FormField><div className="actions"><button className="button button--primary" disabled={busy}>{busy ? 'Saving…' : 'Save profile'}</button><Link to={`/contributors/${user.id}`}>Cancel</Link></div></form></section>
}
