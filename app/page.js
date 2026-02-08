'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'

export default function Home() {
  const searchParams = useSearchParams()
  const initialQuery = searchParams.get('query') || ''
  const existingI = searchParams.get('i') || ''
  const existingId = searchParams.get('id') || ''

  const [messages, setMessages] = useState([])
  const [input, setInput] = useState(initialQuery)
  const [scene, setScene] = useState({ id: existingId, i: existingI })

  useEffect(() => {
    if (initialQuery) {
      handleSend()
    }
  }, [])

  const handleSend = async () => {
    if (!input.trim()) return

    const userMessage = { role: 'user', content: input }
    setMessages(prev => [...prev, userMessage])
    setInput('')

    // Call API
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: input, scene })
    })
    const data = await response.json()
    const botMessage = { role: 'assistant', content: data.response, images: data.images }
    setMessages(prev => [...prev, botMessage])
    if (data.newScene) setScene(data.newScene)
  }

  const createVFBUrl = (scene) => {
    if (!scene.id || !scene.i) return ''
    return `https://v2.virtualflybrain.org/org.geppetto.frontend/geppetto?id=${scene.id}&i=${scene.i}`
  }

  return (
    <div>
      <h1>VFB Chat Client</h1>
      <div style={{ border: '1px solid #ccc', height: '400px', overflowY: 'scroll', padding: 10 }}>
        {messages.map((msg, idx) => (
          <div key={idx} style={{ marginBottom: 10 }}>
            <strong>{msg.role}:</strong> {msg.content}
            {msg.images && msg.images.map((img, i) => (
              <img key={i} src={img.thumbnail} alt={img.label} style={{ maxWidth: 100 }} />
            ))}
          </div>
        ))}
      </div>
      <input
        value={input}
        onChange={e => setInput(e.target.value)}
        onKeyPress={e => e.key === 'Enter' && handleSend()}
        style={{ width: '80%' }}
      />
      <button onClick={handleSend}>Send</button>
      {scene.id && (
        <div>
          <a href={createVFBUrl(scene)} target="_blank">Open in VFB 3D Browser</a>
        </div>
      )}
    </div>
  )
}