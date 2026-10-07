import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { UpdatePrompt } from './components/UpdatePrompt'
import { HoleTracking } from './pages/HoleTracking'
import { Home } from './pages/Home'
import { NewRound } from './pages/NewRound'
import { RoundSummary } from './pages/RoundSummary'
import { Rounds } from './pages/Rounds'
import { Stats } from './pages/Stats'

export default function App() {
  return (
    <HashRouter>
      <main className="app">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/new" element={<NewRound />} />
          <Route path="/rounds" element={<Rounds />} />
          <Route path="/stats" element={<Stats />} />
          <Route path="/round/:roundId/hole/:holeNumber" element={<HoleTracking />} />
          <Route path="/round/:roundId/summary" element={<RoundSummary />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <UpdatePrompt />
    </HashRouter>
  )
}