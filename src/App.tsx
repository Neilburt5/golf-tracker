import { UpdatePrompt } from './components/UpdatePrompt'
import { useOnlineStatus } from './hooks/useOnlineStatus'

export default function App() {
  const online = useOnlineStatus()

  return (
    <main className="app">
      <h1>Golf Tracker</h1>
      <p className="subtitle">Fase 1: PWA vacía</p>

      <p className={online ? 'status online' : 'status offline'}>
        {online ? 'Con conexión' : 'Sin conexión'}
      </p>

      <p className="build">Build: {__BUILD_TIME__}</p>

      <UpdatePrompt />
    </main>
  )
}