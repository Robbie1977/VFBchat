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