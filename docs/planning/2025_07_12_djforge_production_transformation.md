# DJForge Production Transformation Planning

## Current State
- **Frontend**: React 18.3.1 + TypeScript + Vite
- **Backend**: Express.js + TypeScript
- **AI Integration**: Claude CLI (command line)
- **Spotify Control**: Mix of AppleScript (local) and Web API
- **Session Management**: File-based with 30-day persistence
- **Deployment**: Local only

## Proposed Changes

### 1. LLM Integration Migration
**Current**: Claude CLI execution with structured prompts
**Options**:
- Anthropic Claude API (direct API calls)
- OpenAI GPT-4o 
- Google Gemini (Flash for speed + web search)
- OpenRouter (access to all models)

**Key Challenge**: Ensuring structured JSON output similar to current CLI approach

### 2. Spotify Control Migration
**Current**: AppleScript for local control + some Web API
**Proposed**: Full Spotify Web API implementation
- Remove all AppleScript dependencies
- Implement playback control via Web API
- Add currently playing track display with album art
- Support all Spotify Web API features (seek, shuffle, repeat, etc.)

### 3. Tech Stack Consideration
**Current**: React + Express
**Proposed Option**: Vue + Laravel (user preference)
**Alternative**: Keep React + Express but make it more maintainable

**Factors to Consider**:
- Migration effort vs improvement to existing stack
- Time to market
- Maintainability for the developer
- Performance implications

### 4. Mobile & Hosting Requirements
- Must work on mobile browsers
- Hosted website (not local)
- Responsive design
- Real-time updates of playback state

## Questions to Explore

1. **LLM Integration**:
   - How to ensure consistent JSON output from different LLM providers?
   - Which model offers best balance of speed, cost, and music understanding?
   - Should we implement fallback between models?

2. **Architecture**:
   - Is full migration to Vue/Laravel worth the effort?
   - Could we achieve comfort with Express through better structure?
   - What's the fastest path to production?

3. **Spotify Web API**:
   - Device selection strategy for playback control
   - Handling offline devices
   - Real-time playback state synchronization

4. **User Experience**:
   - How to handle natural language ambiguity?
   - Should we show alternative interpretations?
   - How to provide feedback during processing?

## Success Criteria
1. Works seamlessly on mobile and desktop browsers
2. Sub-second response time for commands
3. Reliable structured output from LLM
4. Full Spotify playback control via Web API
5. Clean, maintainable codebase
6. Cost-effective LLM usage

## Next Steps
1. Consult with AI models for technical recommendations
2. Create detailed technical architecture
3. Decide on tech stack (migrate or improve)
4. Plan implementation phases
5. Set up development roadmap