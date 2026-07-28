import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { api } from '../api/client'
import { ErrorState, LoadingState } from '../components/AsyncState'
import FormField from '../components/FormField'
import ImageDropInput from '../components/ImageDropInput'
import MediaImage from '../components/MediaImage'
import { useApi } from '../hooks/useApi'

const MAX_GALLERY_IMAGES = 4
const initial = { name: '', description: '', city: '', google_maps_url: '', official_website: '', travel_tips: '', best_season: 'year_round', latitude: '', longitude: '', prefecture_id: '' }

export default function PlaceFormPage() {
  const { id } = useParams(); const editing = Boolean(id); const navigate = useNavigate(); const [params] = useSearchParams()
  const { data: prefectures, loading: prefLoading } = useApi('/prefectures/')
  const { data: place, loading: placeLoading, error } = useApi(editing ? `/places/${id}/` : '/health/', [id])
  const [values, setValues] = useState(initial); const [image, setImage] = useState(null); const [removeImage, setRemoveImage] = useState(false)
  const [existingGallery, setExistingGallery] = useState([]); const [pendingGallery, setPendingGallery] = useState([])
  const [initialRemovedGalleryIds, setInitialRemovedGalleryIds] = useState([]); const [removedGalleryIds, setRemovedGalleryIds] = useState([]); const [removedPendingImageIds, setRemovedPendingImageIds] = useState([])
  const [galleryFiles, setGalleryFiles] = useState([]); const [errors, setErrors] = useState({}); const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (editing && place?.id) {
      const revision = place.latest_revision
      const source = revision && ['pending', 'rejected'].includes(revision.status) ? revision : place
      const pendingRevision = revision?.status === 'pending' ? revision : null
      setValues({ name: source.name, description: source.description, city: source.city, google_maps_url: source.google_maps_url, official_website: source.official_website, travel_tips: source.travel_tips, best_season: source.best_season, latitude: source.latitude || '', longitude: source.longitude || '', prefecture_id: String(source.prefecture.id) })
      setExistingGallery(place.gallery_images || [])
      setPendingGallery(pendingRevision?.gallery_images || [])
      setRemoveImage(Boolean(pendingRevision?.remove_image))
      setInitialRemovedGalleryIds(pendingRevision?.removed_gallery_image_ids || [])
      setRemovedGalleryIds(pendingRevision?.removed_gallery_image_ids || [])
    } else if (!editing && prefectures) {
      const selected = prefectures.find((prefecture) => prefecture.name === params.get('prefecture'))
      setValues((current) => ({ ...current, prefecture_id: String(selected?.id || '') }))
    }
  }, [editing, place, prefectures, params])

  if (prefLoading || placeLoading) return <LoadingState />
  if (error) return <ErrorState error={error} />

  const pendingRevision = place?.latest_revision?.status === 'pending' ? place.latest_revision : null
  const keptGalleryCount = existingGallery.length - removedGalleryIds.length + pendingGallery.length - removedPendingImageIds.length
  const remainingGallerySlots = Math.max(0, MAX_GALLERY_IMAGES - keptGalleryCount)
  const displayedMainImage = pendingRevision?.image_url || place?.image_url
  const change = (event) => setValues((current) => ({ ...current, [event.target.name]: event.target.value }))
  const chooseMainImage = (file) => { setImage(file); if (file) setRemoveImage(false) }
  const chooseGalleryFiles = (files) => {
    const selected = [...files]
    if (selected.length > remainingGallerySlots) {
      setErrors((current) => ({ ...current, gallery_images: `You can add ${remainingGallerySlots} more gallery photo${remainingGallerySlots === 1 ? '' : 's'}.` }))
      setGalleryFiles(selected.slice(0, remainingGallerySlots)); return
    }
    setErrors((current) => ({ ...current, gallery_images: undefined })); setGalleryFiles(selected)
  }
  const toggleGalleryRemoval = (imageId) => { setRemovedGalleryIds((current) => current.includes(imageId) ? current.filter((value) => value !== imageId) : [...current, imageId]); setGalleryFiles([]) }
  const togglePendingRemoval = (imageId) => { setRemovedPendingImageIds((current) => current.includes(imageId) ? current.filter((value) => value !== imageId) : [...current, imageId]); setGalleryFiles([]) }
  const submit = async (event) => {
    event.preventDefault(); setBusy(true); setErrors({})
    const body = new FormData(); Object.entries(values).forEach(([key, value]) => body.append(key, value)); if (image) body.append('image', image); if (editing) body.append('remove_image', String(removeImage && !image))
    try {
      const result = await api(editing ? `/places/${id}/` : '/places/', { method: editing ? 'PATCH' : 'POST', body })
      for (const galleryImage of existingGallery) {
        const wasRemoved = initialRemovedGalleryIds.includes(galleryImage.id); const isRemoved = removedGalleryIds.includes(galleryImage.id)
        if (wasRemoved !== isRemoved) await api(`/places/${result.id}/images/${galleryImage.id}/`, { method: isRemoved ? 'DELETE' : 'POST' })
      }
      for (const imageId of removedPendingImageIds) await api(`/places/${result.id}/revision-images/${imageId}/`, { method: 'DELETE' })
      for (const [index, file] of galleryFiles.entries()) { const galleryBody = new FormData(); galleryBody.append('image', file); galleryBody.append('display_order', String(keptGalleryCount + index)); await api(`/places/${result.id}/images/`, { method: 'POST', body: galleryBody }) }
      navigate(`/places/${result.id}/${result.slug}`)
    } catch (requestError) { setErrors(requestError.fields || { general: requestError.message }) } finally { setBusy(false) }
  }

  return <section className="form-page"><div><p className="eyebrow">{editing ? 'Update your contribution' : 'Community contribution'}</p><h1>{editing ? 'Edit place' : 'Suggest a place'}</h1><p>{editing ? place.latest_revision?.status === 'pending' ? 'Update your pending proposal. The approved place stays public until an administrator accepts these changes.' : 'Your proposed changes will be reviewed before they replace the approved place.' : 'Your destination will be reviewed by the Japan 47 team before publication.'}</p></div><form onSubmit={submit} encType="multipart/form-data">{errors.general && <p className="form-error">{errors.general}</p>}
    <FormField label="Prefecture" name="prefecture_id" errors={errors} required><select id="prefecture_id" name="prefecture_id" value={values.prefecture_id} onChange={change} required><option value="">Choose a prefecture</option>{prefectures.map((prefecture) => <option key={prefecture.id} value={prefecture.id}>{prefecture.name} · {prefecture.region.label}</option>)}</select></FormField>
    <FormField label="Place name" name="name" errors={errors} required><input id="name" name="name" value={values.name} onChange={change} maxLength="120" required /></FormField>
    <FormField label="Description" name="description" errors={errors} required><textarea id="description" name="description" value={values.description} onChange={change} rows="7" required /></FormField>
    <FormField label="Best season" name="best_season" errors={errors} required><select id="best_season" name="best_season" value={values.best_season} onChange={change}><option value="year_round">Year-round</option><option value="spring">Spring</option><option value="summer">Summer</option><option value="autumn">Autumn</option><option value="winter">Winter</option></select></FormField>
    <FormField label="Main image" name="image" errors={errors} hint="JPEG, PNG, WebP, or HEIF; maximum 8 MB.">{editing && displayedMainImage && !image && <div className={`existing-main-image${removeImage ? ' existing-main-image--removed' : ''}`}><MediaImage src={displayedMainImage} alt={`${place.name} current main`} /><div><strong>{removeImage ? 'Main image will be removed after approval' : pendingRevision?.image_url ? 'Proposed main image' : 'Current main image'}</strong><button type="button" className="button" onClick={() => setRemoveImage((current) => !current)}>{removeImage ? 'Keep image' : 'Remove image'}</button></div></div>}{image && <div className="selected-files"><span>New main image: {image.name}</span><button type="button" onClick={() => setImage(null)}>Clear selection</button></div>}<ImageDropInput id="image" onFiles={chooseMainImage} /></FormField>
    <FormField label="Gallery images" name="gallery_images" errors={errors} hint={`Up to ${MAX_GALLERY_IMAGES} additional photos. ${remainingGallerySlots} slot${remainingGallerySlots === 1 ? '' : 's'} available.`}>{editing && existingGallery.length > 0 && <div className="existing-gallery-editor">{existingGallery.map((galleryImage) => { const removed = removedGalleryIds.includes(galleryImage.id); return <article className={removed ? 'is-removed' : ''} key={galleryImage.id}><MediaImage src={galleryImage.thumbnail_url || galleryImage.image_url} alt={galleryImage.caption || `${place.name} gallery photo`} /><button type="button" onClick={() => toggleGalleryRemoval(galleryImage.id)}>{removed ? 'Keep photo' : 'Remove photo'}</button></article> })}</div>}{pendingGallery.length > 0 && <><small>Photos already included in this pending proposal</small><div className="existing-gallery-editor">{pendingGallery.map((galleryImage) => { const removed = removedPendingImageIds.includes(galleryImage.id); return <article className={removed ? 'is-removed' : ''} key={galleryImage.id}><MediaImage src={galleryImage.thumbnail_url || galleryImage.image_url} alt={galleryImage.caption || `${place.name} proposed gallery photo`} /><button type="button" onClick={() => togglePendingRemoval(galleryImage.id)}>{removed ? 'Keep photo' : 'Remove photo'}</button></article> })}</div></>}{galleryFiles.length > 0 && <div className="selected-files"><span>{galleryFiles.length} new gallery photo{galleryFiles.length === 1 ? '' : 's'} selected</span><button type="button" onClick={() => setGalleryFiles([])}>Clear selection</button></div>}{remainingGallerySlots > 0 && <ImageDropInput id="gallery_images" multiple onFiles={chooseGalleryFiles} />}</FormField>
    <div className="form-grid">{[['city','City'],['google_maps_url','Google Maps URL'],['official_website','Official website']].map(([name,label]) => <FormField key={name} label={label} name={name} errors={errors}><input id={name} name={name} type={name.includes('url') || name.includes('website') ? 'url' : 'text'} value={values[name]} onChange={change} /></FormField>)}</div>
    <div className="form-grid"><FormField label="Latitude" name="latitude" errors={errors} hint="Optional, between -90 and 90."><input id="latitude" name="latitude" type="number" min="-90" max="90" step="0.000001" value={values.latitude} onChange={change} /></FormField><FormField label="Longitude" name="longitude" errors={errors} hint="Optional, between -180 and 180."><input id="longitude" name="longitude" type="number" min="-180" max="180" step="0.000001" value={values.longitude} onChange={change} /></FormField></div>
    <FormField label="Travel tips" name="travel_tips" errors={errors}><textarea id="travel_tips" name="travel_tips" value={values.travel_tips} onChange={change} rows="4" /></FormField><div className="actions"><button disabled={busy} className="button button--primary">{busy ? 'Saving…' : editing ? place.latest_revision?.status === 'pending' ? 'Update pending changes' : 'Submit changes for review' : 'Submit for review'}</button><Link to={editing ? `/places/${id}/${place.slug}` : '/places'}>Cancel</Link></div>
  </form></section>
}
