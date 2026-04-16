import { Home } from './pages/Home.tsx'
import { ErrorBoundary } from './components/shared/ErrorBoundary.tsx'

function App() {
  return (
    <ErrorBoundary>
      <Home />
    </ErrorBoundary>
  )
}

export default App
