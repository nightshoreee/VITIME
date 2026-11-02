import { useCallback, useEffect, useRef, useState } from 'react'

// Loads data with loading/error state; ignores stale responses.
export function useAsync(fn, deps = []) {
  const [state, setState] = useState({ data: null, loading: true, error: null })
  const run = useRef(0)
  const load = useCallback(async () => {
    const id = ++run.current
    setState((s) => ({ ...s, loading: true, error: null }))
    try {
      const data = await fn()
      if (id === run.current) setState({ data, loading: false, error: null })
    } catch (error) {
      if (id === run.current) setState({ data: null, loading: false, error })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
  useEffect(() => { load() }, [load])
  const setData = useCallback((d) => setState((s) => ({ ...s, data: typeof d === 'function' ? d(s.data) : d })), [])
  return { ...state, reload: load, setData }
}
