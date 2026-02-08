import { NextResponse } from 'next/server'

export async function POST(request) {
  const { message, scene } = await request.json()

  // Guardrailed prompt
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

Current scene context: id=${scene.id}, i=${scene.i}

User query: ${message}`

  // Call Ollama
  const ollamaUrl = process.env.OLLAMA_URL || 'http://localhost:11434'
  let ollamaResponse
  try {
    ollamaResponse = await fetch(`${ollamaUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'phi3:3.8b',
        prompt: systemPrompt,
        stream: false
      })
    })
  } catch (error) {
    return NextResponse.json({ 
      response: "Error: Unable to connect to Ollama. Please ensure Ollama is running and the Phi-3 model is installed.", 
      images: [], 
      newScene: scene 
    }, { status: 500 })
  }

  if (!ollamaResponse.ok) {
    const errorText = await ollamaResponse.text()
    let errorMessage = "Error: Ollama returned an error."
    if (ollamaResponse.status === 404) {
      errorMessage = "Error: Model not found. Please ensure the Phi-3 model is pulled: `ollama pull phi3:3.8b`"
    }
    return NextResponse.json({ 
      response: errorMessage, 
      images: [], 
      newScene: scene 
    }, { status: ollamaResponse.status })
  }

  const ollamaData = await ollamaResponse.json()
  const response = ollamaData.response

  // Parse for images from the response text
  const thumbnailRegex = /https:\/\/www\.virtualflybrain\.org\/data\/VFB\/i\/([^/]+)\/([^/]+)\/thumbnail(?:T)?\.png/g
  const images = []
  let match
  while ((match = thumbnailRegex.exec(response)) !== null) {
    const templateId = match[1]
    const imageId = match[2]
    images.push({
      id: imageId,
      template: templateId,
      thumbnail: match[0],
      label: `VFB Image ${imageId}`
    })
  }

  // Also check for any structured image data that might come from MCP tools
  // This is a placeholder for when MCP integration provides structured image data

  const newScene = scene // update if needed based on response content

  return NextResponse.json({ response, images, newScene })
}