'use client'

import { useState, useEffect, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import ReactMarkdown from 'react-markdown'

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
  const chatEndRef = useRef(null)

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isThinking, thinkingDots])

  function createVFBUrl(scene) {
    if (!scene.id) return '#'
    const baseUrl = 'https://v2.virtualflybrain.org/org.geppetto.frontend/geppetto'
    return `${baseUrl}?id=${encodeURIComponent(scene.id)}${scene.i ? `&i=${encodeURIComponent(scene.i)}` : ''}`
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
      setMessages([{
        role: 'assistant',
        content: `Welcome to VFB Chat! I'm here to help you explore Drosophila neuroanatomy and neuroscience using Virtual Fly Brain data.

**Important AI Usage Guidelines:**
- Always verify information from AI responses with primary sources
- Conversations are monitored for quality control and system improvement
- Do not share confidential or sensitive information
- Use this tool to enhance your understanding of neuroscience concepts

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

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: input, scene })
      })

      if (!response.ok) throw new Error(`HTTP ${response.status}`)

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
                setMessages(prev => [...prev, { role: 'reasoning', content: data.text }])
              } else if (currentEvent === 'result') {
                setMessages(prev => [...prev, { role: 'assistant', content: data.response, images: data.images }])
                if (data.newScene) setScene(data.newScene)
                setIsThinking(false)
                return
              } else if (currentEvent === 'error') {
                setMessages(prev => [...prev, { role: 'assistant', content: data.message }])
                setIsThinking(false)
                return
              }
            } catch (parseError) {
              console.error('Failed to parse streaming data:', parseError)
            }
          }
        }
      }
    } catch (error) {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Sorry, there was an error processing your request. Please try again.' }])
      setIsThinking(false)
    }
  }

  const getDisplayName = (role) => {
    if (role === 'user') return 'Researcher'
    if (role === 'assistant') return 'VFB'
    if (role === 'reasoning') return 'VFB'
    return role
  }

  // Custom renderers for react-markdown
  const renderLink = ({ href, children }) => {
    const isVfbId = href && !href.startsWith('http') && (href.startsWith('VFB') || href.startsWith('FBbt') || href.startsWith('FBrf'))
    const url = isVfbId
      ? `https://v2.virtualflybrain.org/org.geppetto.frontend/geppetto?id=${href}`
      : href
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        style={{ color: '#66d9ff', textDecoration: 'underline', textDecorationColor: '#66d9ff40' }}
        title={isVfbId ? 'View in VFB' : undefined}
      >
        {children}
      </a>
    )
  }

  const renderImage = ({ src, alt }) => {
    const isThumbnail = src && src.includes('virtualflybrain.org/data/VFB')
    if (!isThumbnail) {
      return (
        <span style={{ display: 'inline-block', margin: '4px', verticalAlign: 'middle' }}>
          <img src={src} alt={alt || 'Image'} style={{ maxWidth: '300px', maxHeight: '200px', borderRadius: '4px' }} />
        </span>
      )
    }
    // VFB thumbnail: compact with hover-to-expand
    return (
      <span className="vfb-thumb-wrap" style={{ display: 'inline-block', margin: '4px', verticalAlign: 'middle', position: 'relative' }}>
        <img
          src={src}
          alt={alt || 'VFB Image'}
          className="vfb-thumb"
          style={{
            width: '64px',
            height: '64px',
            objectFit: 'cover',
            border: '1px solid #444',
            borderRadius: '4px',
            cursor: 'pointer',
            verticalAlign: 'middle',
            transition: 'opacity 0.15s'
          }}
        />
        <span className="vfb-thumb-expanded" style={{
          position: 'absolute',
          bottom: '100%',
          left: '0',
          display: 'none',
          backgroundColor: '#111',
          border: '1px solid #444',
          borderRadius: '6px',
          padding: '6px',
          boxShadow: '0 4px 16px rgba(0,0,0,0.7)',
          zIndex: 1000,
          whiteSpace: 'nowrap'
        }}>
          <img
            src={src}
            alt={alt || 'VFB Image'}
            style={{ maxWidth: '280px', maxHeight: '280px', borderRadius: '4px', display: 'block' }}
          />
          {alt && <span style={{ display: 'block', fontSize: '11px', color: '#aaa', marginTop: '4px', textAlign: 'center' }}>{alt}</span>}
        </span>
      </span>
    )
  }

  const markdownComponents = {
    a: renderLink,
    img: renderImage,
    p: ({ children }) => <p style={{ margin: '0.4em 0' }}>{children}</p>,
    ul: ({ children }) => <ul style={{ margin: '0.4em 0', paddingLeft: '20px' }}>{children}</ul>,
    ol: ({ children }) => <ol style={{ margin: '0.4em 0', paddingLeft: '20px' }}>{children}</ol>,
    li: ({ children }) => <li style={{ margin: '0.2em 0' }}>{children}</li>,
    strong: ({ children }) => <strong style={{ color: '#fff' }}>{children}</strong>,
    h1: ({ children }) => <h3 style={{ color: '#fff', margin: '0.5em 0 0.3em' }}>{children}</h3>,
    h2: ({ children }) => <h4 style={{ color: '#fff', margin: '0.5em 0 0.3em' }}>{children}</h4>,
    h3: ({ children }) => <h5 style={{ color: '#fff', margin: '0.5em 0 0.3em' }}>{children}</h5>,
    code: ({ children }) => <code style={{ backgroundColor: '#1a1a2e', padding: '2px 4px', borderRadius: '3px', fontSize: '0.9em' }}>{children}</code>,
  }

  return (
    <div style={{
      backgroundColor: '#000',
      color: '#e0e0e0',
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      padding: '12px 16px',
      boxSizing: 'border-box',
      overflow: 'hidden'
    }}>
      <h1 style={{
        color: '#fff',
        margin: '0 0 8px 0',
        fontSize: '1.3em',
        fontWeight: 600,
        flexShrink: 0
      }}>
        Virtual Fly Brain
      </h1>

      {/* Chat messages area - fills available space */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '12px',
        backgroundColor: '#0a0a0a',
        border: '1px solid #222',
        borderRadius: '8px',
        minHeight: 0
      }}>
        {messages.map((msg, idx) => (
          <div key={idx} style={{
            marginBottom: '12px',
            padding: '8px 12px',
            backgroundColor: msg.role === 'user' ? '#1a1a2e' : 'transparent',
            borderRadius: '6px',
            borderLeft: msg.role === 'user' ? '3px solid #4a9eff' : '3px solid #2a6a3a'
          }}>
            <div style={{
              fontSize: '0.75em',
              fontWeight: 600,
              color: msg.role === 'user' ? '#4a9eff' : '#4ade80',
              marginBottom: '4px',
              textTransform: 'uppercase',
              letterSpacing: '0.5px'
            }}>
              {getDisplayName(msg.role)}
            </div>
            <div
              className="message-content"
              style={msg.role === 'reasoning' ? { fontSize: '0.85em', fontStyle: 'italic', color: '#999' } : {}}
            >
              <ReactMarkdown components={markdownComponents}>
                {msg.content}
              </ReactMarkdown>
            </div>
            {/* Image gallery from API images field */}
            {msg.images && msg.images.length > 0 && (
              <div style={{ marginTop: '8px', display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {msg.images.map((img, i) => (
                  <div key={i} style={{ display: 'inline-block' }}>
                    <img
                      src={img.thumbnail}
                      alt={img.label}
                      style={{
                        width: '80px',
                        height: '80px',
                        objectFit: 'cover',
                        border: '1px solid #444',
                        borderRadius: '4px',
                        cursor: 'pointer'
                      }}
                      title={img.label}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
        {isThinking && (
          <div style={{
            marginBottom: '12px',
            padding: '8px 12px',
            fontSize: '0.9em',
            fontStyle: 'italic',
            color: '#666',
            borderLeft: '3px solid #333',
            borderRadius: '6px'
          }}>
            {thinkingMessage}{thinkingDots}
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Input area */}
      <div style={{
        display: 'flex',
        gap: '8px',
        marginTop: '8px',
        flexShrink: 0
      }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyPress={e => e.key === 'Enter' && handleSend()}
          placeholder="Ask about Drosophila neuroanatomy..."
          style={{
            flex: 1,
            padding: '10px 14px',
            backgroundColor: '#111',
            color: '#fff',
            border: '1px solid #333',
            borderRadius: '6px',
            fontSize: '14px',
            outline: 'none'
          }}
        />
        <button
          onClick={handleSend}
          disabled={isThinking}
          style={{
            padding: '10px 20px',
            backgroundColor: isThinking ? '#333' : '#4a9eff',
            color: '#fff',
            border: 'none',
            borderRadius: '6px',
            cursor: isThinking ? 'not-allowed' : 'pointer',
            fontSize: '14px',
            fontWeight: 600
          }}
        >
          Send
        </button>
      </div>

      {/* VFB Browser link */}
      {scene.id && (
        <div style={{ marginTop: '6px', flexShrink: 0 }}>
          <a
            href={createVFBUrl(scene)}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: '#66d9ff', textDecoration: 'none', fontSize: '0.85em' }}
          >
            Open in VFB 3D Browser &rarr;
          </a>
        </div>
      )}

      <style jsx global>{`
        .vfb-thumb-wrap:hover .vfb-thumb-expanded {
          display: block !important;
        }
        .vfb-thumb-wrap:hover .vfb-thumb {
          opacity: 0.7;
        }
      `}</style>
    </div>
  )
}
