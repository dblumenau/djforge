# Playlist Discovery Token Optimization Guide

## Overview

This guide documents the token optimization implemented for the Spotify playlist discovery feature, which dynamically adjusts LLM token limits based on user-selected parameters to reduce costs while maintaining quality.

## Background

The playlist discovery workflow involves multiple LLM calls:
1. **Selection Phase**: Choose the most relevant playlists from search results
2. **Summarization Phase**: Generate detailed summaries for selected playlists

Previously, these steps used fixed token limits (1000 and 2000 respectively), which was excessive for most use cases.

## Dynamic Token Allocation

### Selection Phase

The selection phase now uses dynamic token allocation based on the number of playlists to render:

```typescript
// Dynamic formula: base tokens + (playlists to select * tokens per playlist)
const selectionMaxTokens = Math.min(500, 100 + (validatedRenderLimit * 15));
```

**Token allocations by render limit:**
- 3 playlists → 145 tokens
- 5 playlists → 175 tokens
- 10 playlists → 250 tokens
- Previous fixed allocation: 1000 tokens

**Why this works:**
- The LLM only needs to output playlist IDs (22 chars each) plus reasoning
- Even with 10 playlists: ~220 chars for IDs + ~280 chars for reasoning = well under 500 tokens
- Reduces token usage by 75-85% for typical searches

### Summarization Phase

The summarization phase uses a more generous allocation since it generates detailed descriptions:

```typescript
// Dynamic formula: base tokens + (playlists to render * tokens per summary)
const summaryMaxTokens = Math.min(1500, 300 + (validatedRenderLimit * 200));
```

**Token allocations by render limit:**
- 3 playlists → 900 tokens
- 5 playlists → 1300 tokens
- 10 playlists → 1500 tokens (capped)
- Previous fixed allocation: 2000 tokens

**Additional optimizations:**
- Temperature reduced from 0.7 to 0.55 for more consistent summaries
- Each playlist summary needs ~150-225 tokens
- Cap at 1500 prevents excessive generation for edge cases

## Implementation Details

### User Controls

The optimization is controlled by three sliders in the UI:
1. **Playlists to fetch** (1-100): How many playlists to search for
2. **Songs to sample** (10-100): How many tracks to analyze per playlist
3. **Results to show** (1-10): How many playlists to render (affects token limits)

### Cross-Provider Compatibility

The token optimizations apply to **all LLM providers**:
- **Gemini Direct API**: Uses `generationConfig.maxOutputTokens`
- **OpenRouter API**: Uses `max_tokens` field
- All models (Claude, GPT-4, Gemini, etc.) benefit from the optimization

### Code Locations

**Backend implementation:**
- `/server/src/routes/playlist-discovery.ts`
  - Lines 1187-1188: Selection token calculation
  - Lines 1543-1544: Summarization token calculation

**Frontend controls:**
- `/client/src/components/playlist-search/PlaylistSearchControls.tsx`
- `/client/src/components/dashboard/PlaylistDiscovery.tsx`

## Cost Impact

### Example: Typical Search (3 playlists)

**Before optimization:**
- Selection: 1000 tokens
- Summarization: 2000 tokens
- Total: 3000 tokens per search

**After optimization:**
- Selection: 145 tokens (-85.5%)
- Summarization: 900 tokens (-55%)
- Total: 1045 tokens per search (-65% reduction)

### Example: Maximum Search (10 playlists)

**Before optimization:**
- Selection: 1000 tokens
- Summarization: 2000 tokens
- Total: 3000 tokens per search

**After optimization:**
- Selection: 250 tokens (-75%)
- Summarization: 1500 tokens (-25%)
- Total: 1750 tokens per search (-42% reduction)

## Best Practices

1. **Default Settings**: The default (20 playlists fetched, 30 songs sampled, 3 rendered) provides optimal balance
2. **Quick Searches**: Use the "Quick" preset (5/10/3) for fastest, cheapest searches
3. **Deep Analysis**: Use "Maximum" preset (100/100/10) when comprehensive results are needed
4. **Model Selection**: Gemini 2.5 Flash remains the most cost-effective option

## Future Enhancements

Potential areas for further optimization:
1. **Adaptive sampling**: Reduce track samples for well-known playlist types
2. **Cached summaries**: Store and reuse summaries for popular playlists
3. **Progressive loading**: Generate summaries on-demand as users scroll
4. **Smart batching**: Group similar playlists for batch summarization

## Monitoring Token Usage

To monitor actual token usage:
1. Check LLM logs at `/api/llm-logs` (admin only)
2. Look for `usage.total_tokens` in the response
3. Compare against the allocated limits to verify efficiency

## Conclusion

This optimization significantly reduces LLM costs while maintaining the quality of playlist discovery results. The dynamic allocation ensures efficient token usage regardless of user preferences or search complexity.