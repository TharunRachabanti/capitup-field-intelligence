import { Routes, Route } from 'react-router-dom'
import FieldBot from './pages/FieldBot'
import Dashboard from './pages/Dashboard'
import Calendar from './pages/Calendar'

function App() {
  return (
    <Routes>
      <Route path="/" element={<FieldBot />} />
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/calendar" element={<Calendar />} />
    </Routes>
  )
}

export default App
