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