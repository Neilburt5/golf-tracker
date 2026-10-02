import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { requestPersistentStorage } from './services/storagePersistence'
import './index.css'

void requestPersistentStorage()

if (navigator.storage?.persist) {
  void navigator.storage.persist();
}
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)