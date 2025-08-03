# Fix Playlist Discovery Bugs and Add Model Selector

**Date**: 2025-08-03 15:45  
**Task**: Fix two critical issues in the LLM-powered playlist discovery system

## Problem Statement

The playlist discovery system has two critical issues:

1. **Missing Model Selector Integration**: Users cannot select their preferred LLM model for playlist curation in the Playlist Discovery tab
2. **Gemini API JSON Parsing Errors**: The Gemini API is returning malformed/incomplete JSON, causing parsing failures

## Current Issues Analysis

### Issue 1: LLM Model Selector Integration
- ModelSelector component exists but is not integrated into PlaylistDiscovery.tsx
- Need to add state management for selected model
- Need to persist model preference in localStorage
- Need to pass selected model to API requests

### Issue 2: Gemini API JSON Parsing Errors
Error patterns observed:
```
warn: Gemini API structured output validation failed: ["JSON parsing failed: SyntaxError: Unexpected end of JSON input"]
error: 🔥 JSON parsing failed for gemini-direct google/gemini-2.5-flash: {}
```

## Clarification Questions

**Please answer these questions by editing this file:**

### Q1: Model Selector UI Placement
Where exactly should the ModelSelector be placed in the Playlist Discovery UI? Should it be:
- A) Above the search input (separate row)
- B) Inline with the search input (same row)
- C) In a settings/options area
- D) Other specific location?
**Your Answer**: 
A

### Q2: Default Model Behavior
What should happen if no model is selected or stored in localStorage?
- A) Default to 'google/gemini-2.5-flash'
- B) Default to a specific OpenRouter model
- C) Show a prompt to select a model first
- D) Other behavior?

**Your Answer**: 
A
### Q3: Error Handling UX
When Gemini fails and we fallback to OpenRouter, should we:
- A) Show a notification to the user about the fallback
- B) Handle it silently and just use the fallback
- C) Ask the user to choose a different model
- D) Other approach?

**Your Answer**: 
A
### Q4: Schema Simplification Scope
For the schema simplification, should I:
- A) Only fix the specific schemas causing errors (playlist selection & summarization)
- B) Review and simplify all schemas in the playlist discovery routes
- C) Focus only on Gemini-specific schema issues
- D) Other scope?
A - but don't break the schemas for the other gemini pathways, those currently work great (eg queue song etc)


### Q5: Testing Priority
Which testing scenario is most critical to verify first:
- A) ModelSelector integration and UI functionality
- B) Gemini error handling and fallback behavior
- C) Model persistence across page refreshes
- D) API request flow with different models

**Your Answer**: 
B
## Proposed Implementation Approach

### Phase 1: Frontend Model Selector Integration
1. Import ModelSelector component into PlaylistDiscovery.tsx
2. Add state management for selected model with localStorage persistence
3. Integrate ModelSelector into the UI at the chosen location
4. Update API calls to include selected model

### Phase 2: Backend Schema and Error Handling Fixes
1. Analyze current schemas in `/server/src/routes/playlist-discovery.ts`
2. Simplify problematic schemas (playlist selection & summarization)
3. Add explicit model routing logic
4. Implement robust error handling with OpenRouter fallback
5. Update LLM request structure to include model parameter

### Phase 3: Testing and Validation
1. Test ModelSelector integration and persistence
2. Verify schema simplification resolves Gemini errors
3. Test fallback behavior when Gemini fails
4. Validate different model selections work correctly

## Files to Modify

### Frontend
- `/client/src/components/dashboard/PlaylistDiscovery.tsx`

### Backend  
- `/server/src/routes/playlist-discovery.ts`

## Success Criteria

- [ ] ModelSelector appears and functions in Discover tab
- [ ] Model selection persists across page refreshes
- [ ] Selected model affects playlist discovery results
- [ ] Gemini parsing errors are resolved
- [ ] Graceful fallback to OpenRouter when Gemini fails
- [ ] User-friendly error messages
- [ ] Backward compatibility maintained

## Risk Assessment

**Low Risk**:
- Adding ModelSelector to frontend (well-established pattern)
- Adding model parameter to API requests

**Medium Risk**:
- Schema simplification (need to ensure LLM output still works)
- Error handling logic (need to test various failure scenarios)

**High Risk**:
- Breaking existing playlist discovery functionality during refactoring

## Implementation Notes

- Keep existing functionality intact
- Ensure backward compatibility
- Default behavior when no model selected needs clarification
- Error handling UX approach needs clarification
- UI placement needs clarification

---

**Next Steps**: Please review and answer the clarification questions above, then I'll proceed with the implementation following the agreed-upon approach.