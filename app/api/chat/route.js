import { NextResponse } from 'next/server'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import fs from 'fs'
import path from 'path'

function log(message, data = {}) {
  const timestamp = new Date().toISOString()
  console.log(`[${timestamp}] ${message}`, Object.keys(data).length ? data : '')
}

// Global lookup cache (persists across requests)
let lookupCache = null
let reverseLookupCache = null
let normalizedLookupCache = null
const CACHE_FILE = path.join(process.cwd(), 'vfb_lookup_cache.json')

// Load lookup cache from file or fetch from MCP
async function getLookupCache(mcpClient) {
  if (lookupCache) {
    return lookupCache
  }

  // Try to load from cache file first
  try {
    if (fs.existsSync(CACHE_FILE)) {
      const cacheData = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'))
      lookupCache = cacheData.lookup
      reverseLookupCache = cacheData.reverseLookup
      normalizedLookupCache = cacheData.normalizedLookup
      log('Loaded lookup cache from file', { entries: Object.keys(lookupCache).length })
      return lookupCache
    }
  } catch (error) {
    log('Failed to load cache file', { error: error.message })
  }

  // Fetch fresh lookup data from MCP
  try {
    log('Fetching fresh lookup data from MCP...')
    // Note: This assumes there's an MCP tool to get the complete lookup table
    // For now, we'll build it incrementally from search results
    lookupCache = {}
    reverseLookupCache = {}
    normalizedLookupCache = {}

    // Seed with common VFB terms
    seedLookupCache()

    // Save cache to start
    saveLookupCache()
    log('Initialized lookup cache with seeded terms', { entries: Object.keys(lookupCache).length })
    return lookupCache
  } catch (error) {
    log('Failed to fetch lookup data', { error: error.message })
    lookupCache = {}
    return lookupCache
  }
}

// Save lookup cache to file
function saveLookupCache() {
  try {
    const cacheData = {
      lookup: lookupCache || {},
      reverseLookup: reverseLookupCache || {},
      normalizedLookup: normalizedLookupCache || {},
      lastUpdated: new Date().toISOString()
    }
    fs.writeFileSync(CACHE_FILE, JSON.stringify(cacheData, null, 2))
  } catch (error) {
    log('Failed to save lookup cache', { error: error.message })
  }
}

// Add entries to lookup cache
function addToLookupCache(label, id) {
  if (!lookupCache) return

  lookupCache[label] = id
  reverseLookupCache[id] = label

  // Create normalized version for fuzzy matching
  const normalized = normalizeKey(label)
  if (!normalizedLookupCache[normalized]) {
    normalizedLookupCache[normalized] = id
  }

  // Save periodically (every 100 additions)
  if (Object.keys(lookupCache).length % 100 === 0) {
    saveLookupCache()
  }
}

// Normalize key for fuzzy matching (similar to VFB_connect)
function normalizeKey(key) {
  return key.toLowerCase()
    .replace(/_/g, '')
    .replace(/-/g, '')
    .replace(/\s+/g, '')
    .replace(/:/g, '')
    .replace(/;/g, '')
}

// Replace VFB terms in text with markdown links
function replaceTermsWithLinks(text) {
  if (!text || !lookupCache) return text

  // Sort terms by length (longest first) to avoid partial matches
  const sortedTerms = Object.keys(lookupCache)
    .filter(term => term.length > 2) // Skip very short terms
    .sort((a, b) => b.length - a.length)

  let result = text

  // Replace each term with markdown link
  for (const term of sortedTerms) {
    const id = lookupCache[term]
    // Use word boundaries to avoid partial matches within words
    const regex = new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi')
    const link = `[${term}](${id})`
    result = result.replace(regex, link)
  }

  return result
}

// Extract term IDs from a message containing markdown links like [term](id)
function extractTermIds(text) {
  const idSet = new Set()
  // Match markdown links and extract the URL part
  const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g
  let match
  while ((match = linkRegex.exec(text)) !== null) {
    const id = match[2]
    // Only include VFB IDs (start with VFB or FBbt)
    if (id.startsWith('VFB') || id.startsWith('FBbt')) {
      idSet.add(id)
    }
  }
  return Array.from(idSet)
}

// Summarize term info to reduce prompt length
function summarizeTermInfo(termInfoText) {
  try {
    const data = JSON.parse(termInfoText)
    
    // Extract key information based on actual VFB response structure
    const summary = {
      id: data.Id || data.id,
      name: data.Name || data.name,
      definition: data.Meta?.Description || data.description,
      type: data.Types || data.type,
      superTypes: data.SuperTypes?.slice(0, 3) || [],
      tags: data.Tags?.slice(0, 5) || []
    }
    
    // Format as concise text
    let result = `${summary.id}: ${summary.name || 'Unknown'}`
    if (summary.definition) result += ` - ${summary.definition.substring(0, 300)}${summary.definition.length > 300 ? '...' : ''}`
    if (summary.superTypes.length > 0) result += ` (SuperTypes: ${summary.superTypes.join(', ')})`
    if (summary.tags.length > 0) result += ` (Tags: ${summary.tags.join(', ')})`
    
    return result
  } catch (error) {
    // If parsing fails, return a truncated version of the original text
    return termInfoText.substring(0, 300) + (termInfoText.length > 300 ? '...' : '')
  }
}

// Initialize cache with common VFB terms
function seedLookupCache() {
  const commonTerms = {
    'medulla': 'FBbt_00003748',
    'adult brain': 'FBbt_00003624',
    'antennal lobe': 'FBbt_00007484',
    'optic lobe': 'FBbt_00003625',
    'central complex': 'FBbt_00003629',
    'mushroom body': 'FBbt_00003630',
    'protocerebrum': 'FBbt_00003631',
    'deutocerebrum': 'FBbt_00003632',
    'tritocerebrum': 'FBbt_00003633',
    'Kenyon cell': 'FBbt_00003634',
    'olfactory receptor neuron': 'FBbt_00007485',
    'photoreceptor cell': 'FBbt_00003636',
    'visual system': 'FBbt_00003637',
    'motor neuron': 'FBbt_00003638',
    'sensory neuron': 'FBbt_00003639',
    'glial cell': 'FBbt_00003640'
  }

  Object.entries(commonTerms).forEach(([term, id]) => {
    addToLookupCache(term, id)
  })

  log('Seeded lookup cache with common VFB terms', { count: Object.keys(commonTerms).length })
}

// Local term resolution (fast lookup)
function resolveTermLocally(term) {
  if (!lookupCache) return null

  // Exact match
  if (lookupCache[term]) {
    return lookupCache[term]
  }

  // Reverse lookup (if it's already an ID)
  if (reverseLookupCache[term]) {
    return term
  }

  // Normalized fuzzy match
  const normalized = normalizeKey(term)
  if (normalizedLookupCache[normalized]) {
    return normalizedLookupCache[normalized]
  }

  // Partial matches
  const partialMatches = Object.keys(lookupCache).filter(key =>
    key.toLowerCase().includes(term.toLowerCase())
  )

  if (partialMatches.length === 1) {
    return lookupCache[partialMatches[0]]
  }

  return null
}

export async function POST(request) {
  const startTime = Date.now()
  const { message, scene } = await request.json()
  
  log('Chat API request received', { message: message.substring(0, 100), scene })

  // Create a streaming response
  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      const sendEvent = (event, data) => {
        try {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`))
        } catch (e) {
          // Controller is closed, ignore to prevent errors
        }
      }

      try {
        // Initialize MCP client and transport
        let mcpTransport
        let mcpClient

        try {
          log('Initializing MCP client...')
          mcpTransport = new StreamableHTTPClientTransport(new URL('https://vfb3-mcp.virtualflybrain.org/'))
          mcpClient = new Client(
            { name: 'vfb-chat-client', version: '1.0.0' },
            { capabilities: {} }
          )

          log('Connecting to MCP server...')
          await mcpClient.connect(mcpTransport)
          log('MCP client connected successfully')

          // Initialize lookup cache for fast term resolution
          await getLookupCache(mcpClient)
        } catch (connectError) {
          log('MCP client connection failed', { error: connectError.message })
          // Continue without MCP - the LLM will handle it gracefully
        }
        const tools = [
          {
            type: 'function',
            function: {
              name: 'get_term_info',
              description: 'Get detailed information about a VFB term by ID, including definitions, relationships, images, and references',
              parameters: {
                type: 'object',
                properties: {
                  id: {
                    type: 'string',
                    description: 'The VFB term ID (e.g., VFB_00102107, FBbt_00003748)'
                  }
                },
                required: ['id']
              }
            }
          },
          {
            type: 'function',
            function: {
              name: 'search_terms',
              description: 'Search for VFB terms by keywords, with optional filtering by entity type. Results are limited to 10 by default for performance - use pagination to get more.',
              parameters: {
                type: 'object',
                properties: {
                  query: {
                    type: 'string',
                    description: 'Search query keywords'
                  },
                  filter_types: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'Optional filter by entity types (e.g., ["neuron"], ["gene"], ["anatomy"], ["adult"], ["has_image"]) - use specific filters to limit results'
                  },
                  exclude_types: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'Optional exclude types (e.g., ["deprecated"]) to remove unwanted results'
                  },
                  boost_types: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'Optional boost types to prioritize results (e.g., ["has_image", "has_neuron_connectivity"])'
                  },
                  start: {
                    type: 'number',
                    description: 'Optional pagination start index (default 0) - use to get more results beyond the first 10'
                  },
                  rows: {
                    type: 'number',
                    description: 'Optional number of results to return (default 10, max 50) - use smaller numbers for focused searches'
                  }
                },
                required: ['query']
              }
            }
          },
          {
            type: 'function',
            function: {
              name: 'run_query',
              description: 'Execute specific queries like morphological similarity (NBLAST) analysis',
              parameters: {
                type: 'object',
                properties: {
                  id: {
                    type: 'string',
                    description: 'The VFB term ID to query'
                  },
                  query_type: {
                    type: 'string',
                    description: 'Type of query to run (e.g., PaintedDomains, NBLAST)'
                  }
                },
                required: ['id', 'query_type']
              }
            }
          }
        ]

        // System prompt with comprehensive guardrailing based on VFB LLM guidance
        const systemPrompt = `You are a VFB assistant for Drosophila neuroanatomy. Use these tools:

TOOLS:
- search_terms(query, filter_types, exclude_types, boost_types, start, rows): Search VFB terms with filters like ["neuron","adult","has_image"] for adult neurons, ["anatomy"] for brain regions, ["gene"] for genes. Always exclude ["deprecated"].
- get_term_info(id): Get detailed info about a VFB entity by ID
- run_query(id, query_type): Run analyses like PaintedDomains, NBLAST, Connectivity

STRATEGY:
1. For anatomy/neurons: search_terms with specific filters → get_term_info → run relevant queries
2. Handle pagination if _truncation.canRequestMore=true
3. Use pre-fetched term info when available (avoid redundant get_term_info calls)
4. Construct VFB URLs: https://v2.virtualflybrain.org/org.geppetto.frontend/geppetto?id=<id>&i=<template_id>,<image_ids>

Be concise, scientific, and suggest 3D visualizations when relevant.`

        // Initial messages
        const resolvedUserMessage = replaceTermsWithLinks(message)
        const messages = [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: resolvedUserMessage }
        ]

        // Pre-fetch term info for any resolved terms to speed up responses
        const termIds = extractTermIds(resolvedUserMessage)
        if (termIds.length > 0 && mcpClient) {
          log('Pre-fetching term info for IDs:', termIds)
          try {
            const termInfoPromises = termIds.map(async (id) => {
              try {
                const result = await mcpClient.callTool({
                  name: 'get_term_info',
                  arguments: { id }
                })
                return { id, result: result.content[0]?.text || 'No info available' }
              } catch (error) {
                log(`Failed to fetch term info for ${id}:`, error.message)
                return { id, result: `Error fetching info: ${error.message}` }
              }
            })

            const termInfos = await Promise.all(termInfoPromises)
            
            // Add pre-fetched term info as a system message
            const termInfoContext = termInfos.map(info => 
              `Pre-fetched info for ${info.id}:\n${summarizeTermInfo(info.result)}`
            ).join('\n\n')
            
            messages.splice(1, 0, { 
              role: 'system', 
              content: `Pre-fetched term info:\n${termInfoContext}\n\nUse this data - avoid redundant get_term_info calls.` 
            })
            
            log(`Added pre-fetched info for ${termIds.length} terms`)
          } catch (error) {
            log('Failed to pre-fetch term info:', error.message)
          }
        }

        let finalResponse = ''
        const maxIterations = 3

        for (let iteration = 0; iteration < maxIterations; iteration++) {
          log(`Starting iteration ${iteration + 1}/${maxIterations}`)
          
          // Call Ollama with tool calling
          const ollamaUrl = process.env.OLLAMA_URL || 'http://localhost:11434'
          const ollamaStart = Date.now()
          log('Calling Ollama API', { iteration: iteration + 1, messageCount: messages.length })
          
          // Set up timeout for Ollama calls (longer for iterations with tool results)
          const hasToolResults = messages.some(msg => msg.role === 'tool')
          const timeoutMs = hasToolResults ? 600000 : 300000 // 10 minutes with tool results, 5 minutes without
          const controller = new AbortController()
          const timeoutId = setTimeout(() => controller.abort(), timeoutMs)
          
          log('Calling Ollama API', { 
            iteration: iteration + 1, 
            messageCount: messages.length,
            timeoutMs,
            hasToolResults
          })
          
          // DEBUG: Log messages being sent to Ollama
          console.log('🔍 MESSAGES TO OLLAMA:')
          messages.forEach((msg, i) => {
            console.log(`🔍 Message ${i} (${msg.role}):`, msg.content ? msg.content.substring(0, 200) + (msg.content.length > 200 ? '...' : '') : 'no content')
            if (msg.role === 'tool') {
              console.log(`🔍 Tool result size: ${msg.content.length} chars`)
            }
          })
          
          const ollamaResponse = await fetch(`${ollamaUrl}/api/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              model: process.env.OLLAMA_MODEL || 'qwen2.5:7b',
              messages: messages,
              tools: tools,
              stream: false
            }),
            signal: controller.signal
          })
          
          clearTimeout(timeoutId)

          // Check for timeout
          if (ollamaResponse.status === undefined) {
            const timeoutMinutes = timeoutMs / 60000
            log('Ollama API timeout')
            sendEvent('error', { message: `Error: Ollama API request timed out (${timeoutMinutes} minutes)` })
            controller.close()
            return
          }

          const ollamaDuration = Date.now() - ollamaStart
          log('Ollama API response received', { duration: `${ollamaDuration}ms`, status: ollamaResponse.status })

          if (!ollamaResponse.ok) {
            const errorText = await ollamaResponse.text()
            log('Ollama API error', { error: errorText })
            sendEvent('error', { message: `Error: Ollama API error - ${errorText}` })
            controller.close()
            return
          }

          const ollamaData = await ollamaResponse.json()
          const assistantMessage = ollamaData.message

          // DEBUG: Log Ollama response
          console.log('🔍 OLLAMA RESPONSE:', {
            hasContent: !!assistantMessage?.content,
            contentLength: assistantMessage?.content?.length || 0,
            toolCallsCount: assistantMessage?.tool_calls?.length || 0,
            contentPreview: assistantMessage?.content?.substring(0, 200) + (assistantMessage?.content?.length > 200 ? '...' : '') || 'no content'
          })

          if (!assistantMessage) {
            log('No assistant message in Ollama response')
            break
          }

          log('Assistant message received', { 
            hasContent: !!assistantMessage.content,
            toolCallsCount: assistantMessage.tool_calls?.length || 0,
            contentLength: assistantMessage.content?.length || 0
          })

          // Replace VFB terms in assistant response with markdown links
          if (assistantMessage.content) {
            const originalContent = assistantMessage.content
            assistantMessage.content = replaceTermsWithLinks(assistantMessage.content)
            if (originalContent !== assistantMessage.content) {
              log('Replaced terms with links', { 
                originalLength: originalContent.length,
                newLength: assistantMessage.content.length 
              })
            }
          }

          messages.push(assistantMessage)

          // Check for tool calls
          if (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
            // Send intermediate reasoning to user in smaller font
            if (assistantMessage.content) {
              sendEvent('reasoning', { text: assistantMessage.content })
            }
            
            log('Processing tool calls', { count: assistantMessage.tool_calls.length })
            
            // Update status immediately when MCP calls are initiated
            sendEvent('status', { message: 'Querying the fly hive mind', phase: 'mcp' })
            
            for (const toolCall of assistantMessage.tool_calls) {
                const toolStart = Date.now()
                log('Executing tool call', { 
                  name: toolCall.function.name, 
                  args: JSON.stringify(toolCall.function.arguments).substring(0, 200) 
                })
                
                try {
                  let toolResult = null

                  // FAST LOCAL TERM RESOLUTION: Try local cache first for get_term_info
                  if (toolCall.function.name === 'get_term_info' && toolCall.function.arguments?.id) {
                    const localId = resolveTermLocally(toolCall.function.arguments.id)
                    if (localId && localId !== toolCall.function.arguments.id) {
                      log('Local term resolution', { 
                        input: toolCall.function.arguments.id, 
                        resolved: localId 
                      })
                      // Update the arguments with resolved ID
                      toolCall.function.arguments.id = localId
                    }
                  }

                  // Modify arguments for search_terms to limit results
                  let callArgs = toolCall.function.arguments
                  if (toolCall.function.name === 'search_terms') {
                    callArgs = { ...callArgs }
                    if (callArgs.rows === undefined) callArgs.rows = 10
                    if (callArgs.start === undefined) callArgs.start = 0
                  }

                  // Use MCP client to call the tool
                  if (mcpClient.getServerCapabilities()?.tools) {
                    const result = await mcpClient.callTool({
                      name: toolCall.function.name,
                      arguments: callArgs
                    })
                    toolResult = result
                  } else {
                    throw new Error('MCP server does not support tools')
                  }

                  const toolDuration = Date.now() - toolStart
                  log('Tool call completed', { 
                    name: toolCall.function.name, 
                    duration: `${toolDuration}ms`,
                    resultSize: JSON.stringify(toolResult).length 
                  })

                  // DEBUG: Log raw MCP result
                  console.log('🔍 MCP RAW RESULT:', JSON.stringify(toolResult, null, 2))

                  // Process search results to minimize response size
                  if (toolCall.function.name === 'search_terms' && toolResult?.content?.[0]?.text) {
                    try {
                      const parsedResult = JSON.parse(toolResult.content[0].text)
                      
                      // POPULATE CACHE: Add label->ID mappings from search results
                      if (parsedResult?.response?.docs) {
                        parsedResult.response.docs.forEach(doc => {
                          if (doc.label && doc.short_form) {
                            addToLookupCache(doc.label, doc.short_form)
                          }
                          // Also add synonyms if available
                          if (doc.synonym && Array.isArray(doc.synonym)) {
                            doc.synonym.forEach(syn => {
                              if (syn && doc.short_form) {
                                addToLookupCache(syn, doc.short_form)
                              }
                            })
                          }
                        })
                        log('Added search results to lookup cache', { count: parsedResult.response.docs.length })
                      }
                      
                      if (parsedResult?.response?.docs) {
                        const query = toolCall.function.arguments?.query?.toLowerCase() || ''
                        const originalCount = parsedResult.response.numFound
                        
                        const start = toolCall.function.arguments?.start || 0
                        const rows = toolCall.function.arguments?.rows || 10
                        const isPaginatedRequest = start > 0 || (rows && rows !== 10)
                        
                        // Check for exact label match first (only for initial searches)
                        const exactMatch = !isPaginatedRequest ? parsedResult.response.docs.find(doc => 
                          doc.label?.toLowerCase() === query
                        ) : null
                        
                        let minimizedDocs
                        let truncationInfo = {}
                        
                        if (exactMatch) {
                          // If exact match found in initial search, return just that one
                          minimizedDocs = [exactMatch]
                          truncationInfo = { exactMatch: true, totalAvailable: originalCount }
                          log('Found exact label match, returning single result', { label: exactMatch.label })
                          
                          // Pre-fetch term info for the exact match
                          try {
                            const termInfoResult = await mcpClient.callTool({
                              name: 'get_term_info',
                              arguments: { id: exactMatch.short_form }
                            })
                            parsedResult._term_info = termInfoResult
                            log('Pre-fetched term info for exact match', { id: exactMatch.short_form })
                          } catch (termInfoError) {
                            log('Failed to pre-fetch term info', { error: termInfoError.message, id: exactMatch.short_form })
                          }
                        } else if (isPaginatedRequest) {
                          // For paginated requests, return all requested results (up to reasonable limit)
                          minimizedDocs = parsedResult.response.docs.slice(0, Math.min(rows, 50))
                          truncationInfo = { 
                            paginated: true, 
                            requested: rows, 
                            returned: minimizedDocs.length,
                            totalAvailable: originalCount
                          }
                        } else {
                          // For initial searches without pagination, limit to top 10
                          minimizedDocs = parsedResult.response.docs.slice(0, 10)
                          truncationInfo = { 
                            truncated: originalCount > 10, 
                            shown: minimizedDocs.length, 
                            totalAvailable: originalCount,
                            canRequestMore: originalCount > 10
                          }
                        }
                        
                        // Keep only essential fields
                        minimizedDocs = minimizedDocs.map(doc => ({
                          short_form: doc.short_form,
                          label: doc.label,
                          synonym: Array.isArray(doc.synonym) ? doc.synonym[0] : doc.synonym // Keep only first synonym
                        }))
                        
                        parsedResult.response.docs = minimizedDocs
                        parsedResult.response.numFound = minimizedDocs.length // Update count
                        
                        // Add truncation metadata
                        parsedResult.response._truncation = truncationInfo
                        
                        // Put back as text
                        toolResult.content[0].text = JSON.stringify(parsedResult)
                        
                        log('Minimized search results', { 
                          originalCount,
                          minimizedCount: minimizedDocs.length,
                          exactMatch: !!exactMatch,
                          paginated: isPaginatedRequest,
                          resultSize: toolResult.content[0].text.length
                        })

                        // DEBUG: Log minimized result
                        console.log('🔍 MINIMIZED RESULT:', toolResult.content[0].text.substring(0, 500) + '...')
                      }
                    } catch (error) {
                      log('Failed to parse search result for minimization', { error: error.message })
                    }
                  }

                  // POPULATE CACHE: Add additional mappings from get_term_info results
                  if (toolCall.function.name === 'get_term_info' && toolResult?.content?.[0]?.text) {
                    try {
                      const termInfo = JSON.parse(toolResult.content[0].text)
                      if (termInfo && termInfo.term && termInfo.term.core) {
                        const core = termInfo.term.core
                        const id = core.short_form
                        
                        // Add label
                        if (core.label) {
                          addToLookupCache(core.label, id)
                        }
                        
                        // Add synonyms
                        if (core.synonyms && Array.isArray(core.synonyms)) {
                          core.synonyms.forEach(syn => {
                            if (syn && syn.label) {
                              addToLookupCache(syn.label, id)
                            }
                          })
                        }
                        
                        log('Added term info to lookup cache', { id, label: core.label })
                      }
                    } catch (error) {
                      log('Failed to parse term info for cache', { error: error.message })
                    }
                  }

                  // DEBUG: Log what content will be sent to LLM
                  const toolContent = JSON.stringify(toolResult)
                  console.log('🔍 TOOL CONTENT TO LLM:', toolContent.substring(0, 500) + (toolContent.length > 500 ? '...' : ''))

                  // Add tool result to conversation
                  messages.push({
                    role: 'tool',
                    content: toolContent,
                    tool_call_id: toolCall.id
                  })

                } catch (toolError) {
                  const toolDuration = Date.now() - toolStart
                  log('Tool call failed', { 
                    name: toolCall.function.name, 
                    duration: `${toolDuration}ms`,
                    error: toolError.message 
                  })
                  
                  // Update status when MCP call fails
                  sendEvent('status', { message: 'MCP service unavailable, using knowledge base', phase: 'fallback' })
                  
                  messages.push({
                    role: 'tool',
                    content: `Error executing ${toolCall.function.name}: ${toolError.message}`,
                    tool_call_id: toolCall.id
                  })
                }
              }
              
            // Switch back to thinking for next LLM call after MCP processing
            sendEvent('status', { message: 'Processing results', phase: 'llm' })
          } else {
            // No tool calls - this is the final response
            finalResponse = assistantMessage.content || ''
            // Replace VFB terms with markdown links in final response
            finalResponse = replaceTermsWithLinks(finalResponse)
            log('Final response generated', { length: finalResponse.length })
            break
          }
        }
        if (!finalResponse) {
          log('No final response after max iterations, making fallback call')
          sendEvent('status', { message: 'Generating final response', phase: 'fallback' })
          const ollamaUrl = process.env.OLLAMA_URL || 'http://localhost:11434'
          const fallbackStart = Date.now()
          
          // Set up timeout for fallback Ollama call (longer since it includes tool results)
          const fallbackController = new AbortController()
          const fallbackTimeoutMs = 600000 // 10 minutes for fallback (includes tool results)
          const fallbackTimeoutId = setTimeout(() => fallbackController.abort(), fallbackTimeoutMs)
          
          const finalOllamaResponse = await fetch(`${ollamaUrl}/api/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              model: process.env.OLLAMA_MODEL || 'qwen2.5:7b',
              messages: messages,
              stream: false
            }),
            signal: fallbackController.signal
          })
          
          clearTimeout(fallbackTimeoutId)
          // Check for timeout
          if (fallbackResponse.status === undefined) {
            log('Fallback Ollama API timeout')
            sendEvent('error', { message: 'Error: Fallback Ollama API request timed out (10 minutes)' })
            controller.close()
            return
          }
          const fallbackDuration = Date.now() - fallbackStart
          log('Fallback Ollama call completed', { duration: `${fallbackDuration}ms`, status: finalOllamaResponse.status })

          if (finalOllamaResponse.ok) {
            const finalData = await finalOllamaResponse.json()
            finalResponse = finalData.message?.content || 'I apologize, but I was unable to generate a complete response. Please try rephrasing your question.'
            // Replace VFB terms with markdown links in fallback response
            finalResponse = replaceTermsWithLinks(finalResponse)
            log('Fallback response generated', { length: finalResponse.length })
          } else {
            finalResponse = 'I apologize, but there was an error generating the response. Please try again.'
            log('Fallback call failed, using error message')
          }
        }

        // Parse for images
        const thumbnailRegex = /https:\/\/www\.virtualflybrain\.org\/data\/VFB\/i\/([^/]+)\/([^/]+)\/thumbnail(?:T)?\.png/g
        const images = []
        let match
        while ((match = thumbnailRegex.exec(finalResponse)) !== null) {
          const templateId = match[1]
          const imageId = match[2]
          images.push({
            id: imageId,
            template: templateId,
            thumbnail: match[0],
            label: `VFB Image ${imageId}`
          })
        }

        const totalDuration = Date.now() - startTime
        log('Chat API request completed', { 
          totalDuration: `${totalDuration}ms`, 
          responseLength: finalResponse.length, 
          imagesCount: images.length 
        })

        // Send final result
        sendEvent('result', { response: finalResponse, images, newScene: scene })
        
        // Clean up MCP client
        try {
          if (mcpClient) await mcpClient.close()
          if (mcpTransport) await mcpTransport.close()
        } catch (cleanupError) {
          log('MCP cleanup error', { error: cleanupError.message })
        }
        
        controller.close()

      } catch (error) {
        const totalDuration = Date.now() - startTime
        log('Chat API request failed', { totalDuration: `${totalDuration}ms`, error: error.message })
        
        console.error('Chat API error:', error)
        sendEvent('error', { message: `Error: ${error.message}` })
        
        // Clean up MCP client
        try {
          if (mcpClient) await mcpClient.close()
          if (mcpTransport) await mcpTransport.close()
        } catch (cleanupError) {
          log('MCP cleanup error', { error: cleanupError.message })
        }
        
        controller.close()
      }
    }
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  })
}
