import { NextResponse } from 'next/server'

export async function POST(request) {
  const { message, scene } = await request.json()

  // Guardrailed prompt
  const systemPrompt = `You are a guardrailed assistant for Virtual Fly Brain (VFB). Your role is to answer questions about Drosophila neuroanatomy using only data from VFB MCP tools. Do not answer questions outside this domain. If the query is off-topic, respond with "I'm sorry, I can only assist with Drosophila neuroanatomy queries using VFB data."

VFB MCP server: https://vfb3-mcp.virtualflybrain.org/

Available tools:
- get_term_info: Get detailed information about a VFB term by ID.
- search_terms: Search for VFB terms by query.
- run_query: Run specific queries on terms.

When providing images, include thumbnail URLs. For scenes, construct URLs as https://v2.virtualflybrain.org/org.geppetto.frontend/geppetto?id=<focus_id>&i=<template_id>,<image_ids>

Limitations:
- Only images aligned to the same template can be viewed together.
- Only one term can be the focus (shown in site info), but all terms' info is available.

Current scene context: id=${scene.id}, i=${scene.i}

User query: ${message}`

  // Call Ollama
  const ollamaResponse = await fetch('http://ollama:11434/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'microsoft/phi3:3.8b',
      prompt: systemPrompt,
      stream: false
    })
  })

  const ollamaData = await ollamaResponse.json()
  const response = ollamaData.response

  // Parse for images and new scene (simplified)
  const images = [] // regex or something to extract
  const newScene = scene // update if needed

  return NextResponse.json({ response, images, newScene })
}