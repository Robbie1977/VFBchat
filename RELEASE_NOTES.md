Release 2.2.9

This release optimizes VFB data queries and prevents LLM hallucinations when running analytical queries.

Changes:
- Optimized query strategy to avoid unnecessary get_term_info calls when displaying multiple neurons in VFB browser
- Enhanced logging to show "pulling info on [ID]" status messages for better user visibility
- Prevented hallucinated query types by requiring get_term_info before run_query calls
- Updated system prompt to only use valid query types from the Queries array returned by get_term_info
- Improved efficiency for bulk neuron display while maintaining accuracy for analytical queries
- Enhanced user experience with clearer status updates during data retrieval

Release 2.2.8

This release fixes incorrect linking of FlyBase reference IDs (FBrf) to point to FlyBase instead of Virtual Fly Brain.

Changes:
- Fixed FBrf ID links to route to FlyBase (https://flybase.org/reports/FBrfXXXXXXX) instead of VFB
- VFB and FBbt IDs continue to link to Virtual Fly Brain as appropriate
- Added distinct tooltips: 'View in FlyBase' vs 'View in VFB' for better user guidance
- Improved link routing logic to handle different ID types correctly
- Enhanced user experience when accessing publication references from VFB data

Release 2.2.7

This release fixes image clipping issues in the chat interface by improving how VFB thumbnail images are displayed.

Changes:
- Fixed image clipping by removing forced square aspect ratio (64x64px) for VFB thumbnails
- Changed thumbnail images to use maxHeight: 64px with auto width for proper aspect ratio
- Switched from objectFit: 'cover' to 'contain' to prevent image distortion
- Increased maxWidth to 120px to allow wider images while maintaining height limit
- Preserves image integrity for brain region anatomical images
- Improved visual quality of inline image thumbnails

Release 2.2.6

This release fixes a critical issue where the LLM was losing conversation context between messages, preventing proper follow-up responses.

Changes:
- Fixed conversation context loss by sending full chat history to API
- Updated frontend to include conversation history in API requests
- Modified backend to process conversation context in LLM prompts
- Maintains system instructions while preserving chat history
- Improved user experience for multi-turn conversations
- Enhanced LLM context awareness for related queries

This resolves the issue where asking "name a neuron in this region" after "medulla?" would result in the AI asking for clarification instead of remembering the medulla context.

Release 2.2.5

This release refines thumbnail image selection by using precise VFB data structure logic based on IsClass and has_image fields.

Changes:
- Implemented precise field selection: IsClass=true uses Examples, IsClass=false + has_image uses Images
- Updated summarizeTermInfo to check IsClass and SuperTypes for correct field selection
- Simplified visual data processing by using single visualData field based on entity type
- Enhanced system prompt with accurate VFB data structure explanation
- Improved LLM guidance for proper Images vs Examples field usage
- Added clearer distinction between "aligned images" (individuals) and "example images" (classes)

Release 2.2.4

This release improves thumbnail image selection by properly handling both individual neuron images and anatomical region examples, with intelligent template prioritization.

Changes:
- Added support for "Examples" field in addition to "Images" field from VFB API
- Anatomical regions (classes) use "Examples" while individual neurons use "Images"
- Implemented template prioritization: JRC2018Unisex → JFRC2 → Ito2014 → others
- Updated system prompt to explain the difference between Images and Examples
- Enhanced summarizeTermInfo function to handle both data types with proper prioritization
- Improved LLM guidance for selecting appropriate thumbnails based on entity type

Release 2.2.3

This release fixes a critical issue where the AI was generating fake thumbnail URLs instead of using actual URLs from VFB data.

Changes:
- Fixed AI hallucination of thumbnail URLs by updating system prompt to explicitly forbid making up URLs
- Enhanced DISPLAYING IMAGES instructions to only show thumbnails when actually available in VFB data
- Added strict warnings against inventing or modifying thumbnail URLs
- Improved LLM guidance to use exact URLs from get_term_info responses only

Release 2.2.2

This release improves paper citation formatting and fixes thumbnail URL generation issues.

Changes:
- Added CITATIONS section to system prompt with common Drosophila neuroscience paper links
- Updated FORMATTING instructions to include [citation](url) format for paper references
- Enhanced term info summarization to include publication data when available
- Added mappings for common citations like Ito et al., 2013 and Ito et al., 2014
- Improved LLM instructions for converting DOI and FBrf IDs into proper links
- Fixed thumbnail URL generation: AI now only shows actual thumbnail URLs from VFB data, never makes up URLs
- Updated DISPLAYING IMAGES instructions to be explicit about only using real URLs from get_term_info responses

Release 2.2.1

This release fixes a critical bug where thumbnail images were displaying placeholder URLs ("...") instead of actual image IDs, preventing proper visualization of VFB neuroscience images.

Changes:
- Fixed system prompt to correctly reference "Images" field instead of outdated "Examples" field
- Updated term info summarization to include actual thumbnail URLs from VFB API responses
- Enhanced pre-fetched term info to provide real image URLs to the LLM
- Improved LLM instructions for extracting and using thumbnail URLs from get_term_info responses
- Added detailed examples of VFB image URL structure in system prompt

Release 2.2.0

This release adds comprehensive usage monitoring and responsible AI usage guidelines to enhance user experience and system quality control.

Changes:
- Implemented Google Analytics tracking for user queries and AI responses
- Added tracking of query text (truncated), query length, response length, and processing duration
- Integrated axios for GA4 API communication
- Updated welcome message with AI usage guidelines and warnings
- Added comprehensive documentation about responsible AI use
- Included warnings about verifying AI responses and privacy considerations
- Enhanced user interface with clear guidelines for academic and research use

Release 2.1.1

This release adds comprehensive security features to protect against jailbreak attempts and enhance the safety of the VFB chat application.

Changes:
- Added advanced jailbreak detection to prevent attempts to bypass safety restrictions
- Implemented blocking of common jailbreak patterns including developer mode, uncensored personas, and system prompt manipulation
- Enhanced security logging for monitoring and analysis
- Updated documentation with security features section

Release 1.1.2

This release includes performance optimizations for the VFB chat application, including compressed system prompts to avoid token limits, improved term resolution caching, and fixes for JSON parsing of VFB MCP responses.

Changes:
- Compressed system prompt to under 4K tokens
- Fixed summarizeTermInfo function for accurate VFB data parsing
- Pre-fetched term information to reduce redundant API calls
- Improved response times and eliminated prompt truncation warnings