# VFB Chat Client

A web-based chat client for exploring Virtual Fly Brain (VFB) data and Drosophila neuroscience using a guardrailed LLM with tool calling, connected to the VFB MCP server via the OpenAI API.

## Features

- URL parameter support for initial queries and existing scene context (`?query=...&i=...&id=...`)
- Chat interface to explore Drosophila neuroanatomy, neural circuits, and research
- Access to VFB datasets, connectome data, and morphological analysis
- Display image thumbnails and construct 3D visualization scenes
- Generate URLs for VFB 3D browser with proper scene management
- Guardrailed responses covering VFB-related topics including papers, techniques, and methodologies
- **Security**: Advanced jailbreak detection to prevent attempts to bypass safety restrictions

## Security

The VFB Chat client includes comprehensive protection against common jailbreak attempts used to bypass LLM safety restrictions. The system automatically detects and blocks messages containing:

- Attempts to override or ignore system instructions
- Requests to enter "developer mode," "uncensored mode," or similar unrestricted states
- Role-playing as alternative AI personas (e.g., DAN, uncensored AI)
- Commands to modify system prompts or disregard rules
- Encoded or hidden prompts designed to circumvent filters

When a jailbreak attempt is detected, users receive a clear warning message and the request is blocked. This ensures the chat remains focused on Drosophila neuroscience and VFB-related topics.

## Setup

1. Ensure Docker and Docker Compose are installed.

2. Clone this repository.

3. Set your OpenAI API key: `export OPENAI_API_KEY=your-key-here`

4. Run `docker-compose up --build` to start the app.

5. To use a different model, set the `OPENAI_MODEL` environment variable: `OPENAI_MODEL=gpt-4o docker-compose up --build`

## Deployment

### Local Development

For development without Docker:
1. Create a `.env.local` file with your API configuration:
   ```
   OPENAI_API_KEY=your-key-here
   OPENAI_BASE_URL=https://api.openai.com/v1
   OPENAI_MODEL=gpt-4o-mini
   ```
2. Run `npm install`
3. Run `npm run dev`

### Docker Hub Deployment via GitHub Actions
The project includes a GitHub Actions workflow (`.github/workflows/docker.yml`) that automatically builds and pushes Docker images to Docker Hub on pushes and pull requests.

1. Set up Docker Hub repository: Create a repository named `vfbchat` under your Docker Hub account (e.g., `robbie1977/vfbchat`).

2. Configure GitHub Secrets:
   - Go to your repository settings > Secrets and variables > Actions
   - Add `DOCKER_HUB_USER`: Your Docker Hub username
   - Add `DOCKER_HUB_PASSWORD`: Your Docker Hub password or access token

3. The workflow will trigger on:
   - Pushes to any branch or tags starting with `v*`
   - Pull requests to `main`

4. Images are built for `linux/amd64` and `linux/arm64` platforms and tagged appropriately.

## Usage

- Access the app at `http://localhost:3000`
- Without URL parameters, the chat starts with a welcome message and example queries
- Append URL parameters for initial setup, e.g., `http://localhost:3000?query=medulla&i=VFB_00101567&id=VFB_00102107`
- Chat with the assistant to explore VFB data
- Click "Open in VFB 3D Browser" to view the scene

## LLM Configuration

- **Model**: Default is `gpt-4o-mini`, configurable via `OPENAI_MODEL` env var. Any OpenAI-compatible model with tool calling support will work.
- **API Endpoint**: Default is `https://api.openai.com/v1`, configurable via `OPENAI_BASE_URL` for use with OpenAI-compatible proxies (e.g., ELM at Edinburgh).
- **Guardrailing**: Implemented via system prompt allowing responses about Drosophila neuroscience, VFB data/tools, research papers, and methodologies while using MCP tools for accurate information.
- **MCP Integration**: The LLM calls VFB MCP tools (`get_term_info`, `search_terms`, `run_query`) via the OpenAI tool calling API.

## VFB MCP Details

- **Server URL**: https://vfb3-mcp.virtualflybrain.org/
- **Tools**:
  - `get_term_info(id)`: Retrieves term details, including images keyed by template.
  - `search_terms(query)`: Searches for terms matching the query.
  - `run_query(id, query_type)`: Runs specific queries (e.g., PaintedDomains) on terms.
- **Data Structure**:
  - Terms have IDs like `VFB_00102107` or `FBbt_00003748`.
  - Images are associated with templates (e.g., `VFB_00101567` for JRC2018Unisex).
  - Thumbnails: `https://www.virtualflybrain.org/data/VFB/i/.../thumbnail.png`
- **URL Construction for Scenes**:
  - `https://v2.virtualflybrain.org/org.geppetto.frontend/geppetto?id=<focus_term_id>&i=<template_id>,<image_id1>,<image_id2>`
  - `id`: Focus term (only one, site shows its info).
  - `i`: Comma-separated list starting with template ID, followed by image IDs.
- **Limitations**:
  - Images must be aligned to the same template to view together.
  - Only one term can be the focus per scene, but all term info is accessible in the chat.
  - Templates define the coordinate space.

## Development

- **Docker**: `docker-compose up --build`
- **Local**: `npm run dev` (requires `.env.local` with API credentials)
- Build: `npm run build`
- API: POST to `/api/chat` with `{ message, scene }`

## License

See LICENSE file.
