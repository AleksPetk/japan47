import { useState } from 'react'
import { api, jsonBody } from '../api/client'
import { ErrorState, LoadingState } from '../components/AsyncState'
import { PlaceCard } from '../components/Cards'
import PageHero from '../components/PageHero'
import { useApi } from '../hooks/useApi'

function PlaceSection({ title, data, empty }) {
  return <section className="feature travel-place-section"><header className="section-header"><div><h2>{title}</h2></div></header>{data?.length ? <div className="grid grid--3">{data.map((item) => <PlaceCard key={item.id} place={item.place} />)}</div> : <p className="travel-empty" title={empty}>Nothing here yet</p>}</section>
}

export default function MyTravelPage() {
  const [revision, setRevision] = useState(0)
  const [collectionName, setCollectionName] = useState('')
  const [itineraryName, setItineraryName] = useState('')
  const [selectedPlaces, setSelectedPlaces] = useState({})
  const [formError, setFormError] = useState('')
  const favorites = useApi('/favorites/')
  const visited = useApi('/visited-places/')
  const collections = useApi('/collections/', [revision])
  const itineraries = useApi('/itineraries/', [revision])
  const loading = favorites.loading || visited.loading || collections.loading || itineraries.loading
  const error = favorites.error || visited.error || collections.error || itineraries.error
  const saved = favorites.data?.results || favorites.data || []
  const create = async (event, type) => { event.preventDefault(); const itinerary = type === 'itinerary'; const name = itinerary ? itineraryName : collectionName; if (!name.trim()) return; setFormError(''); try { await api(itinerary ? '/itineraries/' : '/collections/', { method: 'POST', body: jsonBody({ name: name.trim() }) }); itinerary ? setItineraryName('') : setCollectionName(''); setRevision((value) => value + 1) } catch (err) { setFormError(err.message) } }
  const addPlace = async (type, item) => { const placeId = Number(selectedPlaces[`${type}-${item.id}`]); if (!placeId) return; setFormError(''); try { if (type === 'collection') { await api(`/collections/${item.id}/`, { method: 'PATCH', body: jsonBody({ place_ids: [...new Set([...item.places.map((place) => place.id), placeId])] }) }) } else { await api(`/itineraries/${item.id}/add_stop/`, { method: 'POST', body: jsonBody({ place_id: placeId, day: 1, position: item.stops.length }) }) } setRevision((value) => value + 1) } catch (err) { setFormError(err.message) } }
  const picker = (type, item) => saved.length > 0 && <div className="travel-picker"><label><span className="sr-only">Place to add</span><select value={selectedPlaces[`${type}-${item.id}`] || ''} onChange={(event) => setSelectedPlaces((values) => ({ ...values, [`${type}-${item.id}`]: event.target.value }))}><option value="">Add a saved place…</option>{saved.map(({ place }) => <option key={place.id} value={place.id}>{place.name}</option>)}</select></label><button onClick={() => addPlace(type, item)}>Add</button></div>
  return <section className="page page--discovery discovery-page--compact-hero my-travel-page"><PageHero eyebrow="Your Japan" title="My travel" subtitle="Saved destinations, visited places, collections, and itinerary planning in one place." />{loading ? <LoadingState /> : error ? <ErrorState error={error} /> : <div className="my-travel-content">{formError && <p className="form-error" role="alert">{formError}</p>}<PlaceSection title="Saved places" data={saved} empty="Save places to build your personal Japan list." /><PlaceSection title="Visited places" data={visited.data?.results || visited.data} empty="Mark a destination as visited to track your journey." /><section className="travel-builders"><div><h2>Collections</h2><form onSubmit={(event) => create(event, 'collection')}><label className="sr-only" htmlFor="collection-name">Collection name</label><input id="collection-name" value={collectionName} onChange={(event) => setCollectionName(event.target.value)} placeholder="Kyoto ideas" maxLength="100" /><button className="button button--primary">Create</button></form>{(collections.data?.results || collections.data || []).map((item) => <article key={item.id}><h3>{item.name}</h3><p>{item.places.length} places</p>{picker('collection', item)}</article>)}</div><div><h2>Itineraries</h2><form onSubmit={(event) => create(event, 'itinerary')}><label className="sr-only" htmlFor="itinerary-name">Itinerary name</label><input id="itinerary-name" value={itineraryName} onChange={(event) => setItineraryName(event.target.value)} placeholder="Seven days in Kansai" maxLength="100" /><button className="button button--primary">Create</button></form>{(itineraries.data?.results || itineraries.data || []).map((item) => <article key={item.id}><h3>{item.name}</h3><p>{item.stops.length} stops</p>{picker('itinerary', item)}</article>)}</div></section></div>}</section>
}
