import React from 'react'
import HydrologyDarkChat from './components/HydrologyDarkChat'

export default function App() {
  return (
    <div style={{ 
      height: '100vh', 
      width: '100vw', 
      margin: 0, 
      padding: 0, 
      fontFamily: 'system-ui, Segoe UI, Roboto, Helvetica, Arial',
      backgroundColor: '#000000' // Added black background to match theme
    }}>
      <HydrologyDarkChat />
    </div>
  )
}