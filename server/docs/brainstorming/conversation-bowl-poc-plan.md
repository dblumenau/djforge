# Conversation Bowl POC Plan 🥣

## 🎯 Goal: Minimal Viable Conversation Management 

Build a simple "conversation bowl" system that reuses all your existing GPT-5 Responses API work while adding smart session management.

## 🏗️ What We're Reusing (Your Hard Work!)

### Already Built ✅
- **GPT-5 Responses API integration** (`/server/src/llm/gpt5/`)
- **Function calling infrastructure** (`tools/definitions.ts`, `tools/functions.ts`)  
- **Streaming handler** (`handlers/stream-handler.ts`)
- **Response handler** (`handlers/response-handler.ts`)
- **Test console** (`scripts/test-console.ts`)
- **Session management** (`core/session-manager.ts`)
- **Redis integration** (`core/redis-client.ts`)

### What We Need to Add 🔨
- Simple conversation bowl UI in test console
- Session selection logic  
- Basic session summarization

## 🚀 Phase 1: Minimal POC (2-3 hours work)

### Step 1: Extend Session Data Structure
Update your existing `SessionData` type to support multiple conversations:

```typescript
// Add to /server/src/llm/gpt5/types/index.ts
interface ConversationSession {
  id: string;
  name: string;
  lastResponseId: string | null;
  summary: string;
  tokenCount: number;
  lastUsed: Date;
  conversationHistory: Array<{
    responseId: string;
    input: string;
    output: string;
    timestamp: string;
    model: string;
    hadFunctionCall?: boolean;
  }>;
}

interface SessionData {
  currentSessionId: string | null;
  sessions: Record<string, ConversationSession>;
  metadata: Record<string, any>;
}
```

### Step 2: Update Session Manager
Extend your existing `SessionManager` class:

```typescript
// Modify /server/src/llm/gpt5/core/session-manager.ts
class SessionManager {
  // Keep existing methods, add:
  
  createNewSession(name: string): ConversationSession {
    return {
      id: generateId(),
      name,
      lastResponseId: null,
      summary: "",
      tokenCount: 0,
      lastUsed: new Date(),
      conversationHistory: []
    };
  }
  
  listSessions(sessionData: SessionData): ConversationSession[] {
    return Object.values(sessionData.sessions)
      .sort((a, b) => b.lastUsed.getTime() - a.lastUsed.getTime());
  }
  
  switchToSession(sessionData: SessionData, sessionId: string): void {
    sessionData.currentSessionId = sessionId;
    if (sessionData.sessions[sessionId]) {
      sessionData.sessions[sessionId].lastUsed = new Date();
    }
  }
}
```

### Step 3: Extend Test Console Commands
Add bowl commands to your existing `/server/src/llm/gpt5/cli/commands.ts`:

```typescript
// Add these commands:
'/bowl'        - List all conversation sessions
'/new <name>'  - Create new conversation session  
'/switch <id>' - Switch to existing session
'/summary'     - Show current session summary
```

### Step 4: Update Your Test Console UI
Modify `/server/src/llm/gpt5/scripts/test-console.ts` to show conversation bowl on startup:

```typescript
// Add to interactiveMode() after existing help text:
this.showConversationBowl();

private showConversationBowl(): void {
  const sessions = this.sessionManager.listSessions(this.sessionData);
  
  if (sessions.length === 0) {
    console.log(chalk.cyan('🥣 Conversation Bowl: Empty (use /new <name> to create)'));
    return;
  }
  
  console.log(chalk.bold('\n🥣 Conversation Bowl:'));
  sessions.forEach((session, i) => {
    const current = session.id === this.sessionData.currentSessionId ? '→' : ' ';
    const age = Math.floor((Date.now() - session.lastUsed.getTime()) / (1000 * 60 * 60 * 24));
    console.log(`${current} ${i+1}. ${session.name} (${age}d ago, ${session.tokenCount} tokens)`);
  });
  console.log(`\nCurrent: ${this.getCurrentSessionName()}`);
}
```

## 🧪 Phase 2: Test the POC (30 minutes)

### Test Script:
```bash
cd server/src/llm/scripts
npx tsx test-console.ts

# Try these commands:
/new "Music Discovery"
"I love indie rock and electronic music"
/new "Workout Playlist" 
"I need high energy music for the gym"
/bowl
/switch 1
"Play something like Tame Impala"
```

### Expected Behavior:
1. ✅ Multiple named conversation sessions
2. ✅ Switch between contexts seamlessly  
3. ✅ Each session maintains its own `previous_response_id`
4. ✅ Function calls work in each session
5. ✅ Sessions persist in Redis

## 🎵 Phase 3: Music-Specific Features (1-2 hours)

### Auto-Session Creation
Smart session naming based on first interaction:

```typescript
// If user says "workout music" → auto-create "💪 Workout Session"
// If user says "chill vibes" → auto-create "🌙 Chill Session"  
// If user says "discover new music" → auto-create "🎵 Discovery Session"
```

### Session Summarization
After every 5-10 interactions, auto-generate session summary:

```typescript
async summarizeSession(session: ConversationSession): Promise<string> {
  const recentHistory = session.conversationHistory.slice(-10);
  const summary = await this.openai.responses.create({
    model: "gpt-4o-mini", // Cheaper model for summaries
    input: `Summarize this music conversation in one sentence: ${JSON.stringify(recentHistory)}`,
    instructions: "Create a brief summary of the user's music preferences and requests."
  });
  return summary.output_text;
}
```

## 🏆 Success Metrics

### Minimal POC Success:
- [ ] Can create multiple named conversation sessions
- [ ] Can switch between sessions and maintain context
- [ ] Function calling works in each session context
- [ ] Sessions persist across app restarts

### Enhanced POC Success:  
- [ ] Auto-creates music-themed sessions
- [ ] Generates meaningful session summaries
- [ ] Shows token usage per session
- [ ] Smart session suggestion based on user input

## 🔄 Migration Path

### Keep Everything You Built:
- ✅ All existing GPT-5 infrastructure stays
- ✅ All function calling logic reused
- ✅ Test console becomes the POC interface
- ✅ Redis session storage extended (not replaced)

### Add Only What's Needed:
- 🔨 Session selection UI (20 lines)
- 🔨 Multi-session data structure (30 lines)  
- 🔨 Bowl management commands (50 lines)
- 🔨 Smart session creation (40 lines)

**Total new code: ~150 lines to prove the concept!**

## 🚀 Next Steps After POC

1. **Prove it works** with your test console
2. **Add web UI** for session management  
3. **Integrate with your existing DJ Forge React app**
4. **Add advanced features** (session merging, auto-archiving, etc.)

This plan leverages ALL your existing work while adding the minimum viable conversation bowl system. Ready to build? 🛠️