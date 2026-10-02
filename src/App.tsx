import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { UpdatePrompt } from './components/UpdatePrompt'
import { HoleTracking } from './pages/HoleTracking'
import { Home } from './pages/Home'
import { NewRound } from './pages/NewRound'
import { RoundSummary } from './pages/RoundSummary'

export default function App() {
  return (
    <HashRouter>
      <main className="app">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/new" element={<NewRound />} />
          <Route path="/round/:roundId/hole/:holeNumber" element={<HoleTracking />} />
          <Route path="*" element={<Navigate to="/" replace />} />
          <Route path="/round/:roundId/hole/:holeNumber" element={<HoleTracking />} />
          <Route path="/round/:roundId/summary" element={<RoundSummary />} />
        </Routes>
      </main>
      <UpdatePrompt />
    </HashRouter>
  )
}