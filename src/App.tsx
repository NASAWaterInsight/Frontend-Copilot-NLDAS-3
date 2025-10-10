import React from 'react'
import Chat from './components/Chat'

export default function App() {
  return (
    <div style={{ 
      height: '100vh', 
      width: '100vw', 
      margin: 0, 
      padding: 0, 
      fontFamily: 'system-ui, Segoe UI, Roboto, Helvetica, Arial' 
    }}>
      <Chat />
    </div>
  )
}