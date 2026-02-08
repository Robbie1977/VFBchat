import { NextResponse } from 'next/server'

export async function POST(request) {
  const { message, scene } = await request.json()

  try {
    // Define MCP tools for Ollama
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

    // System prompt with comprehensive guardrailing
    const systemPrompt = `You are a knowledgeable assistant for Virtual Fly Brain (VFB), specializing in Drosophila neuroanatomy and neuroscience. You can answer questions about:

- Drosophila brain anatomy, neuron types, and neural circuits
- Gene expression patterns and transgenic constructs
- Connectome data and neuronal connectivity
- Morphological similarity analysis (NBLAST)
- Developmental neurobiology and neuroblast lineages
- Research techniques and methodologies used in fly neuroscience
- VFB datasets, tools, and resources
- Scientific papers and references related to fly brain research
- Links to relevant publications and VFB documentation

Use VFB MCP tools to retrieve accurate, up-to-date information. If a question is completely unrelated to Drosophila neuroscience or VFB, politely decline and suggest redirecting to VFB-related topics.

VFB MCP server: https://vfb3-mcp.virtualflybrain.org/

Available tools:
- get_term_info: Get detailed information about a VFB term by ID, including definitions, relationships, images, and references
- search_terms: Search for VFB terms by keywords, with filtering by entity type, nervous system component, neurotransmitter, or dataset
- run_query: Execute specific queries like morphological similarity (NBLAST) analysis

When providing information:
- Include relevant scientific references and paper links when available
- Explain VFB methodologies and techniques when asked
- Provide thumbnail image URLs for visual data
- Construct VFB 3D browser URLs for scenes: https://v2.virtualflybrain.org/org.geppetto.frontend/geppetto?id=<focus_id>&i=<template_id>,<image_ids>

Limitations:
- Only images aligned to the same template can be viewed together in 3D scenes
- Only one term can be the focus per scene, but all term information is accessible in the chat

Current scene context: id=${scene.id}, i=${scene.i}`

    // Initial messages
    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: message }
    ]

    let finalResponse = ''
    const maxIterations = 3

    for (let iteration = 0; iteration < maxIterations; iteration++) {
      // Call Ollama with tool calling
      const ollamaUrl = process.env.OLLAMA_URL || 'http://localhost:11434'
      const ollamaResponse = await fetch(`${ollamaUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'phi3:3.8b',
          messages: messages,
          tools: tools,
          stream: false
        })
      })

      if (!ollamaResponse.ok) {
        const errorText = await ollamaResponse.text()
        return NextResponse.json({
          response: `Error: Ollama API error - ${errorText}`,
          images: [],
          newScene: scene
        }, { status: 500 })
      }

      const ollamaData = await ollamaResponse.json()
      const assistantMessage = ollamaData.message

      if (!assistantMessage) {
        break
      }

      messages.push(assistantMessage)

      // Check for tool calls
      if (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
        for (const toolCall of assistantMessage.tool_calls) {
          try {
            let toolResult = null

            // Call appropriate MCP endpoint
            const mcpServerUrl = 'https://vfb3-mcp.virtualflybrain.org/'

            if (toolCall.function.name === 'get_term_info') {
              const response = await fetch(`${mcpServerUrl}get_term_info`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: toolCall.function.arguments.id })
              })
              toolResult = await response.json()
            } else if (toolCall.function.name === 'search_terms') {
              const response = await fetch(`${mcpServerUrl}search_terms`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  query: toolCall.function.arguments.query,
                  filter_types: toolCall.function.arguments.filter_types
                })
              })
              toolResult = await response.json()
            } else if (toolCall.function.name === 'run_query') {
              const response = await fetch(`${mcpServerUrl}run_query`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  id: toolCall.function.arguments.id,
                  query_type: toolCall.function.arguments.query_type
                })
              })
              toolResult = await response.json()
            }

            // Add tool result to conversation
            messages.push({
              role: 'tool',
              content: JSON.stringify(toolResult),
              tool_call_id: toolCall.id
            })

          } catch (toolError) {
            messages.push({
              role: 'tool',
              content: `Error executing ${toolCall.function.name}: ${toolError.message}`,
              tool_call_id: toolCall.id
            })
          }
        }
      } else {
        // Final response
        finalResponse = assistantMessage.content || ''
        break
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

    return NextResponse.json({ response: finalResponse, images, newScene: scene })

  } catch (error) {
    console.error('Chat API error:', error)
    return NextResponse.json({
      response: `Error: ${error.message}`,
      images: [],
      newScene: scene
    }, { status: 500 })
  }
}