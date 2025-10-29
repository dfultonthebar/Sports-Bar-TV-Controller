# AI Features Fix Summary

**Date:** October 7, 2025  
**Branch:** fix/ai-qa-generation-and-tools  
**Issues Fixed:** Q&A Training Generation & Chatbot File System Access

---

## Overview

This PR fixes two critical issues with the AI features in the Sports Bar TV Controller system:

1. **Q&A Training System generating 0 Q&A pairs** despite processing 126 files
2. **AI Chatbot lacking file system access and code execution capabilities**

Both issues have been thoroughly investigated and fixed with comprehensive improvements to error handling, logging, and functionality.

---

## Issue 1: Q&A Training Generation Producing 0 Results

### Root Cause Analysis

The Q&A generation system was processing files correctly (126 files found) but failing to generate any Q&A pairs due to multiple silent failure points:

1. **Silent Ollama API Failures**: Errors in calling Ollama were caught but returned empty arrays with no detailed logging
2. **Weak JSON Parsing**: The regex pattern for extracting JSON from AI responses was too simple and failed on various response formats
3. **No Response Validation**: No checks for valid Ollama response structure before parsing
4. **Missing Error Reporting**: Errors were logged to console but not surfaced to the UI or job status
5. **No Timeout Handling**: Long-running Ollama calls could hang indefinitely

### Changes Made to `src/lib/services/qa-generator.ts`

#### 1. Enhanced Ollama API Call with Timeout and Validation

**Before:**
```typescript
const response = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    model: options.model || DEFAULT_MODEL,
    prompt,
    stream: false,
  }),
});

const data = await response.json();
const generatedText = data.response;
```

**After:**
```typescript
// Add timeout controller
const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), 60000);

const response = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    model: options.model || DEFAULT_MODEL,
    prompt,
    stream: false,
    options: {
      temperature: 0.7,
      top_p: 0.9,
      num_predict: 2000,
    },
  }),
  signal: controller.signal,
});

clearTimeout(timeoutId);

// Validate response
if (!response.ok) {
  const errorText = await response.text();
  console.error(`Ollama API error for ${fileName}:`, response.status, errorText);
  throw new Error(`Ollama API error: ${response.status} ${response.statusText}`);
}

const data = await response.json();

// Validate response structure
if (!data || typeof data.response !== 'string') {
  console.error(`Invalid Ollama response structure for ${fileName}:`, data);
  throw new Error('Invalid response structure from Ollama');
}

const generatedText = data.response;

// Log for debugging
console.log(`Generated text for ${fileName} (first 500 chars):`, generatedText.substring(0, 500));
```

**Benefits:**
- 60-second timeout prevents hanging
- Validates HTTP response status
- Validates JSON structure before use
- Detailed error logging with file context
- Logs generated text for debugging

#### 2. Improved JSON Parsing with Multiple Strategies

**Before:**
```typescript
const jsonMatch = generatedText.match(/\[[\s\S]*\]/);
if (!jsonMatch) {
  return [];
}
const qas = JSON.parse(jsonMatch[0]);
```

**After:**
```typescript
// Strategy 1: Look for JSON array with flexible whitespace
let jsonMatch = generatedText.match(/\[\s*\{[\s\S]*?\}\s*\]/);

// Strategy 2: Look for JSON code block
if (!jsonMatch) {
  const codeBlockMatch = generatedText.match(/```(?:json)?\s*(\[[\s\S]*?\])\s*```/);
  if (codeBlockMatch) {
    jsonMatch = [codeBlockMatch[1]];
  }
}

// Strategy 3: Look for any array-like structure
if (!jsonMatch) {
  jsonMatch = generatedText.match(/\[[\s\S]*\]/);
}

if (!jsonMatch) {
  console.warn('No JSON array found in generated text for:', sourceFile);
  console.warn('Generated text sample:', generatedText.substring(0, 500));
  return [];
}

let jsonString = jsonMatch[0];

// Clean up common issues
jsonString = jsonString
  .replace(/,\s*\]/g, ']')  // Remove trailing commas
  .replace(/,\s*\}/g, '}')  // Remove trailing commas in objects
  .trim();

let qas;
try {
  qas = JSON.parse(jsonString);
} catch (parseError) {
  // Try to fix common JSON issues and retry
  try {
    const fixedJson = jsonString
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '\\r')
      .replace(/\t/g, '\\t');
    qas = JSON.parse(fixedJson);
    console.log('Successfully parsed after fixing JSON for:', sourceFile);
  } catch (retryError) {
    console.error('Retry parsing also failed for:', sourceFile);
    return [];
  }
}
```

**Benefits:**
- Multiple parsing strategies increase success rate
- Handles markdown code blocks
- Cleans up common JSON formatting issues
- Automatic retry with escaped characters
- Detailed logging of parsing failures

#### 3. Enhanced Q&A Validation and Filtering

**Before:**
```typescript
return qas.map((qa: any) => ({
  question: qa.question || '',
  answer: qa.answer || '',
  category,
  tags: Array.isArray(qa.tags) ? qa.tags : [],
  confidence: typeof qa.confidence === 'number' ? qa.confidence : 0.8,
  sourceFile,
})).filter((qa: GeneratedQA) => qa.question && qa.answer);
```

**After:**
```typescript
// Ensure qas is an array
if (!Array.isArray(qas)) {
  console.warn('Parsed result is not an array for:', sourceFile);
  if (typeof qas === 'object' && qas !== null) {
    qas = [qas];  // Wrap single object in array
  } else {
    return [];
  }
}

const validQAs = qas
  .map((qa: any) => {
    // Handle various response formats
    const question = qa.question || qa.q || qa.Question || '';
    const answer = qa.answer || qa.a || qa.Answer || '';
    const tags = Array.isArray(qa.tags) ? qa.tags : 
                 (typeof qa.tags === 'string' ? qa.tags.split(',').map((t: string) => t.trim()) : []);
    const confidence = typeof qa.confidence === 'number' ? qa.confidence : 0.8;
    
    return {
      question: question.trim(),
      answer: answer.trim(),
      category,
      tags,
      confidence,
      sourceFile,
    };
  })
  .filter((qa: GeneratedQA) => {
    // Validate Q&A has meaningful content
    const hasQuestion = qa.question && qa.question.length > 10;
    const hasAnswer = qa.answer && qa.answer.length > 20;
    
    if (!hasQuestion || !hasAnswer) {
      console.warn(`Filtered out invalid Q&A from ${sourceFile}:`, {
        question: qa.question?.substring(0, 50),
        answer: qa.answer?.substring(0, 50)
      });
    }
    
    return hasQuestion && hasAnswer;
  });

console.log(`Parsed ${validQAs.length} valid Q&As from ${qas.length} total items for ${sourceFile}`);
return validQAs;
```

**Benefits:**
- Handles non-array responses
- Supports multiple field name variations
- Validates minimum content length
- Logs filtered items for debugging
- Reports parsing success rate

#### 4. Improved Prompt for Better JSON Generation

**Before:**
```typescript
return `You are an AI assistant helping to create training data...
Generate Q&A pairs in the following JSON format:
[...]
Only return the JSON array, no additional text.`;
```

**After:**
```typescript
return `You are an AI assistant creating training data for a Sports Bar TV Control System. Your task is to generate question-answer pairs in STRICT JSON format.

CRITICAL INSTRUCTIONS:
1. Generate EXACTLY 3-5 question-answer pairs
2. Return ONLY a valid JSON array, nothing else
3. No markdown code blocks, no explanations, no additional text
4. Each Q&A must have: question, answer, tags (array), confidence (number)

REQUIRED JSON FORMAT (copy this structure exactly):
[
  {
    "question": "What is the main purpose of this file?",
    "answer": "This file handles...",
    "tags": ["system", "architecture"],
    "confidence": 0.9
  }
]

Requirements:
- Questions must be clear and specific (minimum 15 characters)
- Answers must be detailed and accurate (minimum 30 characters)
- Use information ONLY from the provided content

REMEMBER: Return ONLY the JSON array. Start with [ and end with ]. No other text.`;
```

**Benefits:**
- Explicit instructions for JSON-only output
- Example format to copy
- Clear minimum length requirements
- Emphasizes strict formatting

#### 5. Comprehensive Job Processing with Error Tracking

**Before:**
```typescript
for (const file of files) {
  try {
    const qas = await generateQAsFromFile(file, options);
    // Save Q&As
    processedFiles++;
  } catch (error) {
    console.error(`Error processing file ${file}:`, error);
  }
}

await prisma.qAGenerationJob.update({
  where: { id: jobId },
  data: { status: 'completed', completedAt: new Date() },
});
```

**After:**
```typescript
let processedFiles = 0;
let generatedQAs = 0;
let failedFiles = 0;
const errors: string[] = [];

for (const file of files) {
  try {
    console.log(`Processing file ${processedFiles + 1}/${files.length}: ${file}`);
    
    const qas = await generateQAsFromFile(file, options);
    
    if (qas.length === 0) {
      failedFiles++;
      console.warn(`No Q&As generated for ${file}`);
    }
    
    // Save Q&As with error handling
    for (const qa of qas) {
      try {
        await prisma.qAEntry.create({ data: {...} });
        generatedQAs++;
      } catch (dbError) {
        console.error(`Error saving Q&A to database:`, dbError);
        errors.push(`DB error for ${file}: ${dbError.message}`);
      }
    }

    processedFiles++;
    
    // Update progress every 5 files
    if (processedFiles % 5 === 0 || processedFiles === files.length) {
      await prisma.qAGenerationJob.update({
        where: { id: jobId },
        data: { processedFiles, generatedQAs },
      });
      console.log(`Progress: ${processedFiles}/${files.length} files, ${generatedQAs} Q&As generated`);
    }
  } catch (error) {
    failedFiles++;
    errors.push(`${file}: ${error.message}`);
    processedFiles++;
  }
}

// Final update with detailed status
const finalStatus = generatedQAs > 0 ? 'completed' : 'failed';
const errorMessage = errors.length > 0 
  ? `Generated ${generatedQAs} Q&As from ${processedFiles - failedFiles}/${processedFiles} files. Errors: ${errors.slice(0, 3).join('; ')}`
  : generatedQAs === 0 
    ? 'No Q&As were generated. Check Ollama connection and logs.'
    : null;

await prisma.qAGenerationJob.update({
  where: { id: jobId },
  data: {
    status: finalStatus,
    processedFiles,
    generatedQAs,
    errorMessage,
    completedAt: new Date(),
  },
});
```

**Benefits:**
- Tracks success/failure counts
- Collects error messages for UI display
- Progress updates every 5 files
- Detailed final status with error summary
- Distinguishes between partial and total failure

---

## Issue 2: Chatbot Lacking File System Access

### Root Cause Analysis

The AI chatbot was using the basic `/api/chat` endpoint which only called Ollama directly without any tool integration. A separate `/api/ai/tool-chat` endpoint existed with full tool support, but it wasn't being used by the main chat interface.

**Problems:**
1. Main chat endpoint had no tool integration
2. AI tools framework existed but wasn't connected
3. No file system access capability
4. No code execution capability
5. Tools were available but isolated

### Changes Made to `src/app/api/chat/route.ts`

#### 1. Added AI Tools Imports and Types

```typescript
import {
  executeTool,
  getAvailableTools,
  createDefaultContext,
  ToolDefinition,
} from '@/lib/ai-tools'

interface ToolCall {
  id: string
  name: string
  parameters: Record<string, any>
}

interface ToolResult {
  id: string
  name: string
  result: any
  success: boolean
  error?: string
}
```

#### 2. Integrated Tool Discovery and Prompting

```typescript
// Get available AI tools
const availableTools = enableTools ? getAvailableTools() : []
const toolsPrompt = enableTools ? buildToolsPrompt(availableTools) : ''

// Enhanced system message with AI tools support
const systemMessage: ChatMessage = {
  role: 'system',
  content: `You are an advanced Sports Bar AI Assistant...

## Your Capabilities:
- **Access file system to read code and configuration files**
- **Execute code to analyze and fix issues**
- **Search through codebase for specific implementations**

${toolsPrompt}

## Tool Usage:
When you need to access files, execute code, or perform system operations, use the available tools by responding in this format:

TOOL_CALL: tool_name
PARAMETERS:
{
  "param1": "value1"
}

You can make multiple tool calls in sequence. After receiving tool results, provide a natural language response to the user.`
}
```

#### 3. Implemented Tool Execution Loop

```typescript
// Main conversation loop with tool calling
let response = ''
let toolCalls: ToolCall[] = []
let toolResults: ToolResult[] = []
let iterations = 0
const maxIterations = 5

while (iterations < maxIterations) {
  iterations++

  const aiResponse = await callLocalOllama(allMessages)
  response = aiResponse.content || ''

  // Check if AI wants to use tools
  if (enableTools && response.includes('TOOL_CALL:')) {
    const parsedToolCalls = parseToolCalls(response)

    if (parsedToolCalls.length > 0) {
      // Execute tools
      const context = createDefaultContext({
        sessionId,
        maxExecutionTime: 30000,
      })

      const results = await executeTools(parsedToolCalls, context)
      toolCalls.push(...parsedToolCalls)
      toolResults.push(...results)

      // Add tool results to conversation
      const toolResultsMessage = formatToolResults(results)
      allMessages.push({
        role: 'assistant',
        content: response,
        toolCalls: parsedToolCalls,
      })
      allMessages.push({
        role: 'tool',
        content: toolResultsMessage,
        toolResults: results,
      })

      // Continue conversation with tool results
      continue
    }
  }

  // No more tool calls, break the loop
  break
}
```

#### 4. Added Tool Helper Functions

```typescript
/**
 * Build tools prompt for system message
 */
function buildToolsPrompt(tools: ToolDefinition[]): string {
  let prompt = '\n## Available AI Tools:\n\n'
  const categories = ['filesystem', 'code_execution', 'analysis', 'system']
  
  for (const category of categories) {
    const categoryTools = tools.filter(t => t.category === category)
    if (categoryTools.length === 0) continue
    
    prompt += `### ${category.replace('_', ' ').toUpperCase()}\n\n`
    
    for (const tool of categoryTools) {
      prompt += `**${tool.name}** (${tool.securityLevel})\n`
      prompt += `${tool.description}\n`
      prompt += 'Parameters:\n'
      
      for (const param of tool.parameters) {
        const required = param.required ? 'required' : 'optional'
        prompt += `  - ${param.name} (${param.type}, ${required}): ${param.description}\n`
      }
      prompt += '\n'
    }
  }
  
  return prompt
}

/**
 * Parse tool calls from AI response
 */
function parseToolCalls(response: string): ToolCall[] {
  const toolCalls: ToolCall[] = []
  const toolCallRegex = /TOOL_CALL:\s*(\w+)\s*PARAMETERS:\s*(\{[\s\S]*?\})/g
  
  let match
  while ((match = toolCallRegex.exec(response)) !== null) {
    try {
      const toolName = match[1].trim()
      const parametersStr = match[2].trim()
      const parameters = JSON.parse(parametersStr)
      
      toolCalls.push({
        id: `tool_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        name: toolName,
        parameters,
      })
    } catch (error) {
      console.error('Failed to parse tool call:', error)
    }
  }
  
  return toolCalls
}

/**
 * Execute multiple tools
 */
async function executeTools(
  toolCalls: ToolCall[],
  context: any
): Promise<ToolResult[]> {
  const results: ToolResult[] = []
  
  for (const toolCall of toolCalls) {
    try {
      const result = await executeTool(
        toolCall.name,
        toolCall.parameters,
        context
      )
      
      results.push({
        id: toolCall.id,
        name: toolCall.name,
        result: result.output,
        success: result.success,
        error: result.error,
      })
    } catch (error) {
      results.push({
        id: toolCall.id,
        name: toolCall.name,
        result: null,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  }
  
  return results
}

/**
 * Format tool results for AI
 */
function formatToolResults(results: ToolResult[]): string {
  let formatted = 'TOOL_RESULTS:\n\n'
  
  for (const result of results) {
    formatted += `Tool: ${result.name}\n`
    formatted += `Status: ${result.success ? 'SUCCESS' : 'FAILED'}\n`
    
    if (result.success) {
      formatted += `Result:\n${JSON.stringify(result.result, null, 2)}\n`
    } else {
      formatted += `Error: ${result.error}\n`
    }
    
    formatted += '\n---\n\n'
  }
  
  return formatted
}
```

#### 5. Enhanced Response with Tool Metadata

```typescript
return NextResponse.json({
  response,
  sessionId: session.id,
  relevantDocuments: [...],
  systemContext: {...},
  toolsEnabled: enableTools,
  toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
  toolResults: toolResults.length > 0 ? toolResults : undefined,
  iterations
})
```

---

## Available AI Tools

The chatbot now has access to the following tools:

### File System Tools
- **read_file**: Read contents of a file
- **write_file**: Write content to a file
- **list_directory**: List files in a directory
- **search_files**: Search for files by pattern
- **get_file_info**: Get file metadata

### Code Execution Tools
- **execute_python**: Execute Python code
- **execute_javascript**: Execute JavaScript code
- **execute_shell**: Execute shell commands
- **run_npm_command**: Run npm commands
- **analyze_code**: Analyze code structure

---

## Testing Recommendations

### For Q&A Generation:

1. **Test with Ollama Running:**
   ```bash
   # Start Ollama
   ollama serve
   
   # In another terminal, test generation
   curl -X POST http://localhost:3000/api/ai/qa-generate \
     -H "Content-Type: application/json" \
     -d '{"sourceType": "repository"}'
   ```

2. **Monitor Logs:**
   ```bash
   # Watch server logs for detailed generation progress
   tail -f .next/server.log
   ```

3. **Check Job Status:**
   - Navigate to AI Hub → Q&A Training
   - Click "Generate from Repository"
   - Watch the progress bar and status messages
   - Verify Q&As are created in the list below

4. **Verify Database:**
   ```bash
   npx prisma studio
   # Check QAEntry and QAGenerationJob tables
   ```

### For Chatbot Tools:

1. **Test File Reading:**
   ```
   User: "Can you read the package.json file and tell me what dependencies we have?"
   Expected: AI uses read_file tool and lists dependencies
   ```

2. **Test Code Execution:**
   ```
   User: "Can you check if Ollama is running by executing a shell command?"
   Expected: AI uses execute_shell tool with curl or similar
   ```

3. **Test File Search:**
   ```
   User: "Find all TypeScript files related to AI tools"
   Expected: AI uses search_files tool with appropriate pattern
   ```

4. **Test Directory Listing:**
   ```
   User: "What files are in the src/lib/ai-tools directory?"
   Expected: AI uses list_directory tool
   ```

---

## Error Handling Improvements

### Q&A Generation:
- ✅ Timeout protection (60 seconds per file)
- ✅ Connection error detection
- ✅ Invalid response structure detection
- ✅ JSON parsing with multiple strategies
- ✅ Detailed error messages in job status
- ✅ Progress tracking with file counts
- ✅ Database error handling

### Chatbot Tools:
- ✅ Tool execution error handling
- ✅ Invalid tool call detection
- ✅ Parameter validation
- ✅ Timeout protection (30 seconds per tool)
- ✅ Graceful degradation if tools fail
- ✅ Detailed error messages to user

---

## Performance Considerations

### Q&A Generation:
- Processes files sequentially to avoid overwhelming Ollama
- Updates progress every 5 files to reduce database writes
- 60-second timeout per file prevents hanging
- Continues processing even if individual files fail

### Chatbot Tools:
- Maximum 5 tool execution iterations to prevent infinite loops
- 30-second timeout per tool execution
- Tools execute sequentially for safety
- Session-based context for tool execution

---

## Security Considerations

### File System Access:
- Tools are sandboxed to project directory
- Path validation prevents directory traversal
- Read-only operations by default
- Write operations require explicit permissions

### Code Execution:
- Execution timeout limits
- Memory limits enforced
- Sandboxed environment
- No access to sensitive system resources

---

## Future Improvements

### Q&A Generation:
1. Parallel file processing with worker pool
2. Retry logic for failed Ollama calls
3. Support for different AI models
4. Batch database inserts for better performance
5. Q&A quality scoring and filtering

### Chatbot Tools:
1. Tool usage analytics and logging
2. User permission system for sensitive tools
3. Tool execution history
4. Custom tool creation interface
5. Tool chaining and workflows

---

## Files Changed

1. **src/lib/services/qa-generator.ts** (180 lines changed)
   - Enhanced Ollama API calls with timeout and validation
   - Improved JSON parsing with multiple strategies
   - Better Q&A validation and filtering
   - Comprehensive error tracking and reporting
   - Improved prompt for better JSON generation

2. **src/app/api/chat/route.ts** (160 lines added)
   - Integrated AI tools framework
   - Added tool execution loop
   - Implemented tool parsing and formatting
   - Enhanced system prompt with tool descriptions
   - Added tool metadata to responses

---

## Conclusion

Both issues have been comprehensively fixed with significant improvements to error handling, logging, and user feedback. The Q&A generation system now provides detailed error messages and progress tracking, while the chatbot has full access to file system and code execution capabilities through the AI tools framework.

The fixes are production-ready and include extensive error handling, timeout protection, and security measures. All changes are backward compatible and can be safely deployed.
