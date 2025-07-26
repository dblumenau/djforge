/**
 * Request context detection utility for adaptive taste profile generation
 * Analyzes user commands to determine the appropriate taste profile context
 */

export type RequestContextType = 'specific' | 'discovery' | 'conversational' | 'control' | 'info';

/**
 * Detect request context type for contextual taste profile generation
 * @param command The user's command/request
 * @returns The detected context type or undefined for general profile
 */
export function detectRequestContextType(command: string): RequestContextType | undefined {
  const lowerCommand = command.toLowerCase().trim();
  
  // Specific song/artist requests - user knows exactly what they want
  const specificPatterns = [
    /play ".*?"/, /play .*? by .*?/, /queue ".*?"/, /queue .*? by .*?/,
    /^play [^,]+ by [^,]+/, /^queue [^,]+ by [^,]+/,
    /specific/, /exact/, /the song/, /the track/
  ];
  if (specificPatterns.some(pattern => pattern.test(lowerCommand))) {
    return 'specific';
  }
  
  // Discovery/mood requests - user wants recommendations
  const discoveryPatterns = [
    /something/, /anything/, /surprise me/, /recommend/, /discover/,
    /sad/, /happy/, /chill/, /upbeat/, /mellow/, /energetic/, /relaxing/,
    /mood/, /vibe/, /feeling/, /atmosphere/,
    /multiple/, /several/, /many/, /more songs/, /a few songs/,
    /similar to/, /like this/, /more like/,
    /workout/, /study/, /sleep/, /party/, /morning/, /evening/,
    /deep cuts/, /obscure/, /hidden gems/, /b-sides/
  ];
  if (discoveryPatterns.some(pattern => pattern.test(lowerCommand))) {
    return 'discovery';
  }
  
  // Conversational requests - questions and discussion
  const conversationalPatterns = [
    /^what/, /^who/, /^when/, /^where/, /^why/, /^how/, /^which/,
    /tell me about/, /do you know/, /have you heard/, /what do you think/,
    /^did/, /^does/, /^has/, /^is/, /^are/, /^was/, /^were/,
    /information/, /learn/, /history/, /background/, /story/,
    /chat/, /talk/, /discuss/
  ];
  if (conversationalPatterns.some(pattern => pattern.test(lowerCommand))) {
    return 'conversational';
  }
  
  // Control requests - playback control
  const controlPatterns = [
    /^play$/, /^pause/, /^stop/, /^skip/, /^next/, /^previous/, /^back/,
    /^volume/, /^shuffle/, /^repeat/, /^clear/, /^resume/,
    /turn up/, /turn down/, /louder/, /quieter/
  ];
  if (controlPatterns.some(pattern => pattern.test(lowerCommand))) {
    return 'control';
  }
  
  // Info requests - getting information about library/playlists
  const infoPatterns = [
    /my playlist/, /my music/, /my library/, /my songs/, /my artists/,
    /show me/, /list/, /get/, /find/,
    /recently played/, /top/, /saved/, /liked/, /favorites/,
    /current/, /now playing/, /what's playing/
  ];
  if (infoPatterns.some(pattern => pattern.test(lowerCommand))) {
    return 'info';
  }
  
  // Default - return undefined for general profile
  return undefined;
}