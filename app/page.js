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

  const formatMessage = (content) => {
    // Replace VFB thumbnail URLs with interactive thumbnails
    const thumbnailRegex = /https:\/\/www\.virtualflybrain\.org\/data\/VFB\/i\/[^/]+\/[^/]+\/thumbnail(?:T)?\.png/g
    return content.replace(thumbnailRegex, (match) => {
      const isTransparent = match.includes('thumbnailT.png')
      const baseUrl = match.replace('/thumbnail.png', '').replace('/thumbnailT.png', '')
      return `<div class="inline-thumbnail-container" style="display: inline-block; margin: 2px; position: relative;">
        <img src="${match}" alt="VFB Image" class="vfb-thumbnail" style="width: 60px; height: 60px; object-fit: cover; border: 1px solid #ddd; cursor: pointer; vertical-align: middle;" />
        <div class="thumbnail-hover" style="position: absolute; top: 100%; left: 0; background: white; border: 1px solid #ccc; border-radius: 4px; padding: 5px; box-shadow: 0 2px 8px rgba(0,0,0,0.15); z-index: 1000; display: none; max-width: 300px;">
          <img src="${baseUrl}/volume.nrrd" alt="VFB Image" style="max-width: 100%; max-height: 200px;" />
        </div>
      </div>`
    })
  }

  return (
    <div>
      <h1>VFB Chat Client</h1>
      <div style={{ border: '1px solid #ccc', height: '400px', overflowY: 'scroll', padding: 10 }}>
        {messages.map((msg, idx) => (
          <div key={idx} style={{ marginBottom: 10 }}>
            <strong>{msg.role}:</strong> <span dangerouslySetInnerHTML={{ __html: formatMessage(msg.content) }} />
            {msg.images && msg.images.map((img, i) => (
              <div key={i} className="thumbnail-container" style={{ display: 'inline-block', margin: '5px', position: 'relative' }}>
                <img 
                  src={img.thumbnail} 
                  alt={img.label} 
                  className="vfb-thumbnail"
                  style={{ width: '80px', height: '80px', objectFit: 'cover', border: '1px solid #ddd', cursor: 'pointer' }}
                  title={img.label}
                />
                <div className="thumbnail-hover" style={{
                  position: 'absolute',
                  top: '100%',
                  left: '0',
                  background: 'white',
                  border: '1px solid #ccc',
                  borderRadius: '4px',
                  padding: '5px',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                  zIndex: 1000,
                  display: 'none',
                  maxWidth: '300px'
                }}>
                  <img 
                    src={img.thumbnail.replace('thumbnail.png', 'volume.nrrd').replace('thumbnailT.png', 'volume.nrrd')} 
                    alt={img.label} 
                    style={{ maxWidth: '100%', maxHeight: '200px' }}
                  />
                  <div style={{ fontSize: '12px', marginTop: '5px', color: '#666' }}>{img.label}</div>
                </div>
              </div>
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
      <style jsx>{`
        .thumbnail-container:hover .thumbnail-hover,
        .inline-thumbnail-container:hover .thumbnail-hover {
          display: block !important;
        }
      `}</style>
    </div>
  )
}