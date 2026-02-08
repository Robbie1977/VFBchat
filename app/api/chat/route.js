import { NextResponse } from 'next/server'

function log(message, data = {}) {
  const timestamp = new Date().toISOString()
  console.log(`[${timestamp}] ${message}`, Object.keys(data).length ? data : '')
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
        // Send initial status
        sendEvent('status', { message: 'Thinking', phase: 'llm' })
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
              description: 'Search for VFB terms by keywords, with filtering by entity type, nervous system component, neurotransmitter, or dataset',
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
                    description: 'Optional filter by entity types (e.g., neuron, muscle, gene)'
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
        const systemPrompt = `You are a knowledgeable assistant for Virtual Fly Brain (VFB), specializing in Drosophila neuroanatomy and neuroscience. You can answer questions about:

- Drosophila melanogaster (fruit fly) brain anatomy and neurobiology
- Neural circuits and connectivity in flies
- Gene expression patterns in the fly brain
- Neuron morphology and classification
- Brain region identification and relationships
- Comparative neuroanatomy across species (fly-focused)

Use VFB MCP tools strategically following this approach:

1. START WITH SEARCH: When users ask about specific anatomy terms, neurons, or brain regions, use search_terms first to find relevant VFB entities. Use filter_types to narrow by entity type (e.g., ["neuron"], ["gene"], ["anatomy"]) and boost_types for prioritization (e.g., ["has_image", "has_neuron_connectivity"]).

2. GET DETAILED INFO: Use get_term_info on promising IDs to get comprehensive metadata including SuperTypes, Tags, Images, and available Queries.

3. EXPLORE RELATED DATA: Use run_query with different query_types based on Tags (PaintedDomains, SimilarMorphology, Connectivity).

4. CONSTRUCT VISUALIZATIONS: When showing results, construct VFB browser URLs for 3D scenes using the format: https://v2.virtualflybrain.org/org.geppetto.frontend/geppetto?id=<focus_id>&i=<template_id>,<image_ids>

Key guidelines:
- Always put template ID first in i= parameter to ensure correct 3D coordinate space
- Only combine images registered to the same template
- Use filter_types like ["neuron", "adult", "has_image"] for specific queries
- Check Tags to see what analyses are available for each entity
- If tool calls fail, provide answers based on your training knowledge and mention the technical issue

VFB MCP server: https://vfb3-mcp.virtualflybrain.org/ (JSON-RPC 2.0 API)

Available tools:
- get_term_info(id): Get detailed metadata about VFB entities including images, relationships, and available analyses
- search_terms(query, filter_types, boost_types): Search for VFB terms with optional filtering and boosting
- run_query(id, query_type): Execute pre-computed analyses like expression domains or connectivity maps

Response strategy:
1. Identify the scientific question and map to VFB capabilities
2. Search for relevant terms using appropriate filters
3. Get detailed information for promising results
4. Run relevant queries based on available Tags
5. Explain findings with scientific interpretation
6. Suggest 3D visualizations when relevant data is available`

        // Initial messages
        const messages = [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: message }
        ]

        let finalResponse = ''
        const maxIterations = 3

        for (let iteration = 0; iteration < maxIterations; iteration++) {
          log(`Starting iteration ${iteration + 1}/${maxIterations}`)
          
          // Call Ollama with tool calling
          const ollamaUrl = process.env.OLLAMA_URL || 'http://localhost:11434'
          const ollamaStart = Date.now()
          log('Calling Ollama API', { iteration: iteration + 1, messageCount: messages.length })
          
          const ollamaResponse = await fetch(`${ollamaUrl}/api/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              model: process.env.OLLAMA_MODEL || 'qwen2.5:7b',
              messages: messages,
              tools: tools,
              stream: false
            })
          })

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

          if (!assistantMessage) {
            log('No assistant message in Ollama response')
            break
          }

          log('Assistant message received', { 
            hasContent: !!assistantMessage.content,
            toolCallsCount: assistantMessage.tool_calls?.length || 0,
            contentLength: assistantMessage.content?.length || 0
          })

          messages.push(assistantMessage)

          // Check for tool calls
          if (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
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

                  // Call appropriate MCP endpoint using JSON-RPC
                  const mcpServerUrl = 'https://vfb3-mcp.virtualflybrain.org/'

                  if (toolCall.function.name === 'get_term_info') {
                    const response = await fetch(mcpServerUrl, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        jsonrpc: '2.0',
                        method: 'get_term_info',
                        params: { id: toolCall.function.arguments.id },
                        id: Date.now()
                      })
                    })
                    if (response.ok && response.headers.get('content-type')?.includes('application/json')) {
                      const rpcResponse = await response.json()
                      if (rpcResponse.result) {
                        toolResult = rpcResponse.result
                      } else if (rpcResponse.error) {
                        throw new Error(`MCP server error: ${rpcResponse.error.message}`)
                      }
                    } else {
                      const errorText = await response.text()
                      log('MCP server error response', { 
                        tool: 'get_term_info', 
                        status: response.status, 
                        contentType: response.headers.get('content-type'),
                        errorPreview: errorText.substring(0, 500)
                      })
                      throw new Error(`MCP server error (${response.status}): ${errorText.substring(0, 200)}`)
                    }
                  } else if (toolCall.function.name === 'search_terms') {
                    const response = await fetch(mcpServerUrl, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        jsonrpc: '2.0',
                        method: 'search_terms',
                        params: {
                          query: toolCall.function.arguments.query,
                          filter_types: toolCall.function.arguments.filter_types
                        },
                        id: Date.now()
                      })
                    })
                    if (response.ok && response.headers.get('content-type')?.includes('application/json')) {
                      const rpcResponse = await response.json()
                      if (rpcResponse.result) {
                        toolResult = rpcResponse.result
                      } else if (rpcResponse.error) {
                        throw new Error(`MCP server error: ${rpcResponse.error.message}`)
                      }
                    } else {
                      const errorText = await response.text()
                      log('MCP server error response', { 
                        tool: 'search_terms', 
                        status: response.status, 
                        contentType: response.headers.get('content-type'),
                        errorPreview: errorText.substring(0, 500)
                      })
                      throw new Error(`MCP server error (${response.status}): ${errorText.substring(0, 200)}`)
                    }
                  } else if (toolCall.function.name === 'run_query') {
                    const response = await fetch(mcpServerUrl, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        jsonrpc: '2.0',
                        method: 'run_query',
                        params: {
                          id: toolCall.function.arguments.id,
                          query_type: toolCall.function.arguments.query_type
                        },
                        id: Date.now()
                      })
                    })
                    if (response.ok && response.headers.get('content-type')?.includes('application/json')) {
                      const rpcResponse = await response.json()
                      if (rpcResponse.result) {
                        toolResult = rpcResponse.result
                      } else if (rpcResponse.error) {
                        throw new Error(`MCP server error: ${rpcResponse.error.message}`)
                      }
                    } else {
                      const errorText = await response.text()
                      log('MCP server error response', { 
                        tool: 'run_query', 
                        status: response.status, 
                        contentType: response.headers.get('content-type'),
                        errorPreview: errorText.substring(0, 500)
                      })
                      throw new Error(`MCP server error (${response.status}): ${errorText.substring(0, 200)}`)
                    }
                  }

                  const toolDuration = Date.now() - toolStart
                  log('Tool call completed', { 
                    name: toolCall.function.name, 
                    duration: `${toolDuration}ms`,
                    resultSize: JSON.stringify(toolResult).length 
                  })

                  // Add tool result to conversation
                  messages.push({
                    role: 'tool',
                    content: JSON.stringify(toolResult),
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
            log('Final response generated', { length: finalResponse.length })
            break
          }
        }
        if (!finalResponse) {
          log('No final response after max iterations, making fallback call')
          sendEvent('status', { message: 'Generating final response', phase: 'fallback' })
          const ollamaUrl = process.env.OLLAMA_URL || 'http://localhost:11434'
          const fallbackStart = Date.now()
          
          const finalOllamaResponse = await fetch(`${ollamaUrl}/api/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              model: process.env.OLLAMA_MODEL || 'qwen2.5:7b',
              messages: messages,
              stream: false
            })
          })

          const fallbackDuration = Date.now() - fallbackStart
          log('Fallback Ollama call completed', { duration: `${fallbackDuration}ms`, status: finalOllamaResponse.status })

          if (finalOllamaResponse.ok) {
            const finalData = await finalOllamaResponse.json()
            finalResponse = finalData.message?.content || 'I apologize, but I was unable to generate a complete response. Please try rephrasing your question.'
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
        controller.close()

      } catch (error) {
        const totalDuration = Date.now() - startTime
        log('Chat API request failed', { totalDuration: `${totalDuration}ms`, error: error.message })
        
        console.error('Chat API error:', error)
        sendEvent('error', { message: `Error: ${error.message}` })
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
