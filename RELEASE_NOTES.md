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