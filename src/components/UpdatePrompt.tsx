import { useRegisterSW } from 'virtual:pwa-register/react'

export function UpdatePrompt() {
  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW()

  if (!offlineReady && !needRefresh) return null

  return (
    <div className="banner" role="status">
      {needRefresh ? (
        <>
          <span>Nueva versión disponible</span>
          <button onClick={() => updateServiceWorker(true)}>Actualizar</button>
          <button className="secondary" onClick={() => setNeedRefresh(false)}>
            Luego
          </button>
        </>
      ) : (
        <>
          <span>Listo para usar sin conexión</span>
          <button className="secondary" onClick={() => setOfflineReady(false)}>
            OK
          </button>
        </>
      )}
    </div>
  )
}