import { createContext, useCallback, useContext, useState } from 'react'
import { CheckCircle2, AlertCircle } from 'lucide-react'

const Ctx = createContext({ toast: () => {} })
export const useToast = () => useContext(Ctx)

export function ToastProvider({ children }) {
  const [items, setItems] = useState([])
  const toast = useCallback((message, type = 'success') => {
    const id = crypto.randomUUID()
    setItems((x) => [...x, { id, message, type }])
    setTimeout(() => setItems((x) => x.filter((i) => i.id !== id)), 4000)
  }, [])
  return (
    <Ctx.Provider value={{ toast }}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 top-3 z-[100] flex flex-col items-center gap-2 px-4" role="status" aria-live="polite">
        {items.map((i) => (
          <div key={i.id} className={`pointer-events-auto flex max-w-sm animate-pop items-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold shadow-lg ${i.type === 'error' ? 'bg-rose-600 text-white' : 'bg-ink text-white'}`}>
            {i.type === 'error' ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />} {i.message}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  )
}
