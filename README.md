# VFB Chat Client

A web-based chat client for exploring Virtual Fly Brain (VFB) data and Drosophila neuroscience using a guardrailed Microsoft Phi-3 mini LLM connected to the VFB MCP server.

## Features

- URL parameter support for initial queries and existing scene context (`?query=...&i=...&id=...`)
- Chat interface to explore Drosophila neuroanatomy, neural circuits, and research
- Access to VFB datasets, connectome data, and morphological analysis
- Display image thumbnails and construct 3D visualization scenes
- Generate URLs for VFB 3D browser with proper scene management
- Guardrailed responses covering VFB-related topics including papers, techniques, and methodologies

## Setup

1. Ensure Docker and Docker Compose are installed.

2. Clone this repository.

3. Run `docker-compose up --build` to start the services.

4. In a separate terminal, pull the Phi-3 model:
   ```
   docker exec -it vfbchat-ollama-1 ollama pull microsoft/phi3:3.8b
   ```

5. Configure the LLM to use the VFB MCP server at `https://vfb3-mcp.virtualflybrain.org/`. This may require custom setup depending on the LLM client used with Ollama. Ensure tool calling is enabled for Phi-3 to access MCP tools.

## Deployment

### Local Development
Follow the Setup steps above.

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
- Append URL parameters for initial setup, e.g., `http://localhost:3000?query=medulla&i=VFB_00101567&id=VFB_00102107`
- Chat with the assistant to explore VFB data
- Click "Open in VFB 3D Browser" to view the scene

## LLM Configuration

- **Model**: Microsoft Phi-3 mini (3.8B parameters)
- **Guardrailing**: Implemented via system prompt allowing responses about Drosophila neuroscience, VFB data/tools, research papers, and methodologies while using MCP tools for accurate information.
- **MCP Integration**: The LLM should be configured to call VFB MCP tools (`get_term_info`, `search_terms`, `run_query`).
- **Resource Requirements**: Runs on CPU-only, minimal RAM (~4-8GB), no GPU needed.
- **Changing Models**: If switching to another model (e.g., Llama 3.2 1B), update the Ollama pull command and ensure compatibility with tool calling and MCP. Update the model name in `app/api/chat/route.js`.

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

- Run locally: `npm run dev` (requires Ollama running separately).
- Build: `npm run build`
- API: POST to `/api/chat` with `{ message, scene }`

## License

See LICENSE file.