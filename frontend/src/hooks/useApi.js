import { useEffect, useState } from 'react'
import { api } from '../api/client'

export function useApi(path, dependencies = []) {
  const [state, setState] = useState({ data: null, loading: true, error: null })
  useEffect(() => {
    let active = true
    setState((current) => ({ ...current, loading: true, error: null }))
    api(path).then((data) => active && setState({ data, loading: false, error: null }))
      .catch((error) => active && setState({ data: null, loading: false, error }))
    return () => { active = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, ...dependencies])
  return state
}
