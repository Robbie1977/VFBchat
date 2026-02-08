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
  const [isThinking, setIsThinking] = useState(false)
  const [thinkingDots, setThinkingDots] = useState('.')
  const [thinkingMessage, setThinkingMessage] = useState('Thinking')

  // Function to create VFB browser URL
  const createVFBUrl = (scene) => {
    if (!scene.id) return '#'
    const baseUrl = 'https://v2.virtualflybrain.org/org.geppetto.frontend/geppetto'
    return `${baseUrl}?id=${encodeURIComponent(scene.id)}${scene.i ? `&i=${encodeURIComponent(scene.i)}` : ''}`
  }

  // Function to render text with markdown links and handle newlines/thumbnails
  const renderTextWithLinks = (text) => {
    if (!text) return text

    // First handle VFB thumbnail URLs
    const thumbnailRegex = /https:\/\/www\.virtualflybrain\.org\/data\/VFB\/i\/[^/]+\/[^/]+\/thumbnail(?:T)?\.png/g
    text = text.replace(thumbnailRegex, (match) => {
      const isTransparent = match.includes('thumbnailT.png')
      const baseUrl = match.replace('/thumbnail.png', '').replace('/thumbnailT.png', '')
      return `<inline-thumbnail data-url="${baseUrl}/volume.nrrd" data-thumb="${match}"></inline-thumbnail>`
    })

    // Split by newlines and process each line
    const lines = text.split('\n')
    const processedLines = lines.map((line, lineIndex) => {
      // Convert markdown links [text](url) to clickable links
      const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g
      const parts = []
      let lastIndex = 0
      let match

      while ((match = linkRegex.exec(line)) !== null) {
        // Add text before the link
        if (match.index > lastIndex) {
          parts.push(line.slice(lastIndex, match.index))
        }

        // Add the link
        const linkText = match[1]
        const linkUrl = match[2]
        parts.push(
          <a
            key={`${lineIndex}-${match.index}`}
            href={linkUrl.startsWith('http') ? linkUrl : `https://v2.virtualflybrain.org/org.geppetto.frontend/geppetto?id=${linkUrl}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: '#4a9eff', textDecoration: 'none', fontWeight: 'bold' }}
            title={`View ${linkText} in VFB`}
          >
            {linkText}
          </a>
        )

        lastIndex = match.index + match[0].length
      }

      // Handle inline thumbnails
      const thumbnailParts = []
      let currentText = lastIndex < line.length ? line.slice(lastIndex) : ''

      if (currentText.includes('<inline-thumbnail')) {
        const thumbRegex = /<inline-thumbnail data-url="([^"]+)" data-thumb="([^"]+)"><\/inline-thumbnail>/g
        let thumbLastIndex = 0
        let thumbMatch

        while ((thumbMatch = thumbRegex.exec(currentText)) !== null) {
          if (thumbMatch.index > thumbLastIndex) {
            thumbnailParts.push(currentText.slice(thumbLastIndex, thumbMatch.index))
          }

          thumbnailParts.push(
            <div key={`thumb-${lineIndex}-${thumbMatch.index}`} className="inline-thumbnail-container" style={{ display: 'inline-block', margin: '2px', position: 'relative' }}>
              <img
                src={thumbMatch[2]}
                alt="VFB Image"
                className="vfb-thumbnail"
                style={{ width: '60px', height: '60px', objectFit: 'cover', border: '1px solid #555', cursor: 'pointer', verticalAlign: 'middle' }}
              />
              <div className="thumbnail-hover" style={{
                position: 'absolute',
                top: '100%',
                left: '0',
                background: '#222',
                border: '1px solid #555',
                borderRadius: '4px',
                padding: '5px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.5)',
                zIndex: 1000,
                display: 'none',
                maxWidth: '300px'
              }}>
                <img src={thumbMatch[1]} alt="VFB Image" style={{ maxWidth: '100%', maxHeight: '200px' }} />
              </div>
            </div>
          )

          thumbLastIndex = thumbMatch.index + thumbMatch[0].length
        }

        if (thumbLastIndex < currentText.length) {
          thumbnailParts.push(currentText.slice(thumbLastIndex))
        }
      } else if (currentText) {
        thumbnailParts.push(currentText)
      }

      return [...parts, ...thumbnailParts]
    })

    // Flatten and add line breaks
    const result = []
    processedLines.forEach((lineParts, index) => {
      result.push(...lineParts)
      if (index < processedLines.length - 1) {
        result.push(<br key={`br-${index}`} />)
      }
    })

    return result.length > 0 ? result : text
  }

  useEffect(() => {
    if (isThinking) {
      const interval = setInterval(() => {
        setThinkingDots(prev => prev === '...' ? '.' : prev + '.')
      }, 500)
      return () => clearInterval(interval)
    }
  }, [isThinking])

  useEffect(() => {
    if (initialQuery) {
      handleSend()
    } else {
      // Add welcome message when no initial query
      setMessages([{
        role: 'assistant',
        content: `Welcome to VFB Chat! I'm here to help you explore Drosophila neuroanatomy and neuroscience using Virtual Fly Brain data.

Here are some example queries you can try:
- What neurons are involved in visual processing?
- Show me images of Kenyon cells
- How does the olfactory system work in flies?
- Find neurons similar to DA1 using NBLAST
- What genes are expressed in the antennal lobe?

Feel free to ask about neural circuits, gene expression, connectome data, or any VFB-related topics!`
      }])
    }
  }, [])

  const handleSend = async () => {
    if (!input.trim()) return

    const userMessage = { role: 'user', content: input }
    setMessages(prev => [...prev, userMessage])
    setInput('')
    setIsThinking(true)
    setThinkingMessage('Thinking')

    const requestStart = Date.now()
    console.log(`[Frontend] Sending chat request: "${input.substring(0, 50)}..."`)

    try {
      // Call API with streaming
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: input, scene })
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let currentEvent = ''
      
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (line.startsWith('event: ')) {
            currentEvent = line.slice(7)
          } else if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6))
              
              if (currentEvent === 'status') {
                setThinkingMessage(data.message)
              } else if (currentEvent === 'reasoning') {
                // Add intermediate reasoning message in smaller font
                const reasoningMessage = { role: 'reasoning', content: data.text }
                setMessages(prev => [...prev, reasoningMessage])
              } else if (currentEvent === 'result') {
                const botMessage = { role: 'assistant', content: data.response, images: data.images }
                setMessages(prev => [...prev, botMessage])
                if (data.newScene) setScene(data.newScene)
                
                const requestDuration = Date.now() - requestStart
                console.log(`[Frontend] Response processed in ${requestDuration}ms: ${data.response.substring(0, 100)}... (${data.images?.length || 0} images)`)
                setIsThinking(false)
                return
              } else if (currentEvent === 'error') {
                const errorMessage = { role: 'assistant', content: data.message }
                setMessages(prev => [...prev, errorMessage])
                setIsThinking(false)
                return
              }
            } catch (parseError) {
              console.error('Failed to parse streaming data:', parseError)
            }
          }
        }
      }

      const requestDuration = Date.now() - requestStart
      console.log(`[Frontend] Stream ended after ${requestDuration}ms`)

    } catch (error) {
      const requestDuration = Date.now() - requestStart
      console.log(`[Frontend] Request failed after ${requestDuration}ms: ${error.message}`)
      
      const errorMessage = { role: 'assistant', content: 'Sorry, there was an error processing your request. Please try again.' }
      setMessages(prev => [...prev, errorMessage])
      setIsThinking(false)
    }
  }

  const formatMessage = (content) => {
    // Replace VFB thumbnail URLs with interactive thumbnails
    const thumbnailRegex = /https:\/\/www\.virtualflybrain\.org\/data\/VFB\/i\/[^/]+\/[^/]+\/thumbnail(?:T)?\.png/g
    let formatted = content.replace(thumbnailRegex, (match) => {
      const isTransparent = match.includes('thumbnailT.png')
      const baseUrl = match.replace('/thumbnail.png', '').replace('/thumbnailT.png', '')
      return `<div class="inline-thumbnail-container" style="display: inline-block; margin: 2px; position: relative;">
        <img src="${match}" alt="VFB Image" class="vfb-thumbnail" style="width: 60px; height: 60px; object-fit: cover; border: 1px solid #555; cursor: pointer; vertical-align: middle;" />
        <div class="thumbnail-hover" style="position: absolute; top: 100%; left: 0; background: #222; border: 1px solid #555; border-radius: 4px; padding: 5px; box-shadow: 0 2px 8px rgba(0,0,0,0.5); z-index: 1000; display: none; max-width: 300px;">
          <img src="${baseUrl}/volume.nrrd" alt="VFB Image" style="max-width: 100%; max-height: 200px;" />
        </div>
      </div>`
    })
    // Convert newlines to HTML line breaks
    return formatted.replace(/\n/g, '<br>')
  }

  const getDisplayName = (role) => {
    if (role === 'user') return 'Researcher'
    if (role === 'assistant') return 'VFB'
    if (role === 'reasoning') return 'VFB'
    return role
  }

  return (
    <div style={{ backgroundColor: '#000', color: '#fff', minHeight: '100vh', padding: '20px' }}>
      <h1 style={{ color: '#fff', marginBottom: '20px' }}>Virtual Fly Brain</h1>
      <div style={{ border: '1px solid #333', height: '400px', overflowY: 'scroll', padding: 10, backgroundColor: '#111', borderRadius: '4px' }}>
        {messages.map((msg, idx) => (
          <div key={idx} style={{ marginBottom: 10 }}>
            <strong style={{ color: '#4a9eff' }}>{getDisplayName(msg.role)}:</strong> 
            <span style={msg.role === 'reasoning' ? { fontSize: '0.85em', fontStyle: 'italic', color: '#ccc' } : {}}>
              {renderTextWithLinks(msg.content)}
            </span>
            {msg.images && msg.images.map((img, i) => (
              <div key={i} className="thumbnail-container" style={{ display: 'inline-block', margin: '5px', position: 'relative' }}>
                <img 
                  src={img.thumbnail} 
                  alt={img.label} 
                  className="vfb-thumbnail"
                  style={{ width: '80px', height: '80px', objectFit: 'cover', border: '1px solid #555', cursor: 'pointer' }}
                  title={img.label}
                />
                <div className="thumbnail-hover" style={{
                  position: 'absolute',
                  top: '100%',
                  left: '0',
                  background: '#222',
                  border: '1px solid #555',
                  borderRadius: '4px',
                  padding: '5px',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.5)',
                  zIndex: 1000,
                  display: 'none',
                  maxWidth: '300px'
                }}>
                  <img 
                    src={img.thumbnail.replace('thumbnail.png', 'volume.nrrd').replace('thumbnailT.png', 'volume.nrrd')} 
                    alt={img.label} 
                    style={{ maxWidth: '100%', maxHeight: '200px' }}
                  />
                  <div style={{ fontSize: '12px', marginTop: '5px', color: '#ccc' }}>{img.label}</div>
                </div>
              </div>
            ))}
          </div>
        ))}
        {isThinking && (
          <div style={{ marginBottom: 10, fontSize: '0.9em', fontStyle: 'italic', color: '#888' }}>
            {thinkingMessage}{thinkingDots}
          </div>
        )}
      </div>
      <div style={{ marginTop: '10px' }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyPress={e => e.key === 'Enter' && handleSend()}
          style={{ 
            width: '80%', 
            padding: '8px', 
            backgroundColor: '#222', 
            color: '#fff', 
            border: '1px solid #555', 
            borderRadius: '4px',
            fontSize: '14px'
          }}
        />
        <button 
          onClick={handleSend}
          style={{
            padding: '8px 16px',
            marginLeft: '10px',
            backgroundColor: '#4a9eff',
            color: '#fff',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '14px'
          }}
        >
          Send
        </button>
      </div>
      {scene.id && (
        <div style={{ marginTop: '10px' }}>
          <a 
            href={createVFBUrl(scene)} 
            target="_blank"
            style={{ color: '#4a9eff', textDecoration: 'none' }}
          >
            Open in VFB 3D Browser
          </a>
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