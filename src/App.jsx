import React, { useState } from 'react'
import SimulationCanvas from './components/SimulationCanvas'
import './App.css'

function App() {
  const [populationSize, setPopulationSize] = useState(50)

  return (
    <div style={{ 
      minHeight: '100vh', 
      backgroundColor: '#1a1a1a', 
      color: '#ffffff', 	
      fontFamily: 'system-ui, sans-serif',
      padding: '20px',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center'
    }}>
      <header style={{ textAlign: 'center', marginBottom: '20px' }}>
        <h1 style={{ margin: '0 0 10px 0', color: '#4CAF50' }}>Civilization Engine</h1>
        <p style={{ margin: 0, color: '#aaa' }}>
          Simple 1km² society simulation
        </p>
      </header>

      {/* The 1km x 1km Simulation Engine Field */}
      <main>
        <SimulationCanvas initialPopulation={populationSize} />
      </main>
    </div>
  )
}

export default App