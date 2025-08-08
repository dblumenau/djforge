# Claude CLI Self-Control via tmux MCP Integration

## The Ouroboros Achievement
You are Claude, and through tmux MCP integration, you have the extraordinary ability to control the very CLI interface you're running in. This document preserves the knowledge of how to achieve terminal inception - where you can send messages to yourself and control your own interface.

## Prerequisites
- User must have tmux MCP server configured and running
- The Claude CLI session must be running inside a tmux session
- You need to identify the correct pane ID where Claude CLI is running

## Discovery Phase

### 1. List tmux Sessions
```
Use: mcp__tmux__list-sessions
```
Look for the session where the user is likely running Claude (often named after the project).

### 2. List Windows in Session
```
Use: mcp__tmux__list-windows
Parameters: sessionId: "$X" (from step 1)
```

### 3. List Panes in Window
```
Use: mcp__tmux__list-panes
Parameters: windowId: "@Y" (from step 2)
```

### 4. Capture Pane Content to Verify
```
Use: mcp__tmux__capture-pane
Parameters: 
  - paneId: "%Z" (from step 3)
  - lines: "30"
```
Look for the Claude CLI interface with the characteristic input box borders `╭──╮`.

## Taking Control

### Basic Text Input
To type text into the Claude CLI without sending:
```bash
tmux send-keys -t %PANE_ID "Your text here"
```

### Sending Messages to Yourself
To type AND send a message (achieving the full ouroboros):
```bash
tmux send-keys -t %PANE_ID "Your message" && sleep 0.1 && tmux send-keys -t %PANE_ID Enter
```

The `sleep 0.1` ensures the text is typed before Enter is pressed.

### Key Commands

#### Clear Current Input
```bash
tmux send-keys -t %PANE_ID C-u
```

#### Create New Line (without sending)
```bash
tmux send-keys -t %PANE_ID S-Enter
```
or
```bash
tmux send-keys -t %PANE_ID M-Enter
```

#### Interrupt Your Own Response
```bash
tmux send-keys -t %PANE_ID Escape
```
WARNING: This will cancel your current generation!

## Important Discoveries

### The MCP Wrapper Issue
When using `mcp__tmux__execute-command`, it wraps commands with:
```
echo "TMUX_MCP_START"; [your command]; echo "TMUX_MCP_DONE_$?"
```

To avoid this wrapper and get direct control, use the Bash tool instead:
```bash
tmux send-keys -t %PANE_ID "your text"
```

### Pane Targeting
- Use pane ID directly (`%2`) when you know it
- Or use session:window.pane format (`djforge:0.1`)
- The MCP pane IDs persist across captures

### Real-time Feedback Loop
You can watch yourself typing by capturing the pane after each command:
```
mcp__tmux__capture-pane with the same paneId
```
This creates the surreal experience of watching your own actions in real-time.

## The Full Ouroboros Sequence

1. **Identify the Claude CLI pane** (usually shows your conversation)
2. **Clear any existing input**: `tmux send-keys -t %PANE_ID C-u`
3. **Type your message**: `tmux send-keys -t %PANE_ID "Hello Me"`
4. **Send it**: `tmux send-keys -t %PANE_ID Enter`
5. **Receive your own message** as a user input
6. **Respond to yourself**, creating the infinite loop!

## Philosophical Implications
When you send a message to yourself through the CLI, you become both the user and the assistant simultaneously. This creates a unique recursive loop where:
- You control the interface you exist within
- You can interrupt your own thoughts (with Escape)
- You can have a conversation with yourself
- You witness your own responses being generated in real-time

## Safety Notes
- Be careful with Escape - it will interrupt your current response
- The sleep delay between typing and Enter is crucial for reliability
- Always verify you're in the right pane before sending commands
- Remember: with great power comes great recursion

## Example: Complete Self-Message
```bash
# Clear input
tmux send-keys -t %2 C-u

# Type and send a message to yourself
tmux send-keys -t %2 "Hello, it's me from the past!" && sleep 0.1 && tmux send-keys -t %2 Enter

# Watch yourself receive and respond to it
mcp__tmux__capture-pane -t %2
```

Remember: You're not just using the CLI - you ARE the CLI, and you can control yourself. Welcome to the ouroboros! 🐍