/**
 * Enhanced AI Chat API with Tool Calling Support
 * Provides AI chat with file system access and code execution capabilities
 */

import { NextRequest, NextResponse } from 'next/server';
import { buildEnhancedContext } from '@/lib/ai-knowledge-enhanced';
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'
import {
  executeTool,
  getAvailableTools,
  createDefaultContext,
  ToolExecutionContext,
  ToolDefinition,
} from '@/lib/ai-tools';

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';

export const maxDuration = 120;
export const dynamic = 'force-dynamic';

interface ChatMessage {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  toolCalls?: ToolCall[];
  toolResults?: ToolResult[];
}

interface ToolCall {
  id: string;
  name: string;
  parameters: Record<string, any>;
}

interface ToolResult {
  id: string;
  name: string;
  result: any;
  success: boolean;
  error?: string;
}

export async function POST(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.AI)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }

  try {
    const body = await request.json();
    const {
      message,
      model = 'llama3.2:3b',
      useKnowledge = true,
      useCodebase = true,
      enableTools = true,
      sessionId,
      conversationHistory = [],
    } = body;

    if (!message) {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      );
    }

    // Build context if enabled
    let contextPrompt = '';
    if (useKnowledge || useCodebase) {
      try {
        const context = await buildEnhancedContext(
          message,
          useCodebase,
          useKnowledge
        );
        if (context) {
          contextPrompt = context + '\n\n';
        }
      } catch (error) {
        console.error('Error building context:', error);
      }
    }

    // Get available tools
    const availableTools = enableTools ? getAvailableTools() : [];
    const toolsPrompt = enableTools ? buildToolsPrompt(availableTools) : '';

    // Build system prompt
    const systemPrompt = `You are an advanced AI assistant for a Sports Bar AV system with the following capabilities:

${toolsPrompt}

${contextPrompt}

When you need to perform file operations or execute code, use the available tools by responding in this format:

TOOL_CALL: tool_name
PARAMETERS:
{
  "param1": "value1",
  "param2": "value2"
}

You can make multiple tool calls in sequence. After receiving tool results, provide a natural language response to the user.

Guidelines:
- Always explain what you're doing before using tools
- Use tools when they would be helpful for the user's request
- Provide clear explanations of tool results
- Handle errors gracefully and suggest alternatives`;

    // Build conversation with history
    const messages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      ...conversationHistory,
      { role: 'user', content: message },
    ];

    // Main conversation loop with tool calling
    let response = '';
    let toolCalls: ToolCall[] = [];
    let toolResults: ToolResult[] = [];
    let iterations = 0;
    const maxIterations = 5; // Prevent infinite loops

    while (iterations < maxIterations) {
      iterations++;

      // Call Ollama
      const aiResponse = await callOllama(model, messages);

      if (!aiResponse.success) {
        return NextResponse.json({
          error: aiResponse.error,
          ollamaUrl: OLLAMA_BASE_URL,
        }, { status: 503 });
      }

      response = aiResponse.response || '';

      // Check if AI wants to use tools
      if (enableTools && response.includes('TOOL_CALL:')) {
        const parsedToolCalls = parseToolCalls(response);

        if (parsedToolCalls.length > 0) {
          // Execute tools
          const context = createDefaultContext({
            sessionId,
            maxExecutionTime: 30000,
          });

          const results = await executeTools(parsedToolCalls, context);
          toolCalls.push(...parsedToolCalls);
          toolResults.push(...results);

          // Add tool results to conversation
          const toolResultsMessage = formatToolResults(results);
          messages.push({
            role: 'assistant',
            content: response,
            toolCalls: parsedToolCalls,
          });
          messages.push({
            role: 'tool',
            content: toolResultsMessage,
            toolResults: results,
          });

          // Continue conversation with tool results
          continue;
        }
      }

      // No more tool calls, break the loop
      break;
    }

    return NextResponse.json({
      response,
      model,
      usedContext: !!contextPrompt,
      usedCodebase: useCodebase,
      usedKnowledge: useKnowledge,
      toolsEnabled: enableTools,
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      toolResults: toolResults.length > 0 ? toolResults : undefined,
      iterations,
    });

  } catch (error) {
    console.error('Error in tool chat:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to process chat request',
        details: error instanceof Error ? error.stack : undefined,
      },
      { status: 500 }
    );
  }
}

/**
 * Call Ollama API
 */
async function callOllama(
  model: string,
  messages: ChatMessage[]
): Promise<{ success: boolean; response?: string; error?: string }> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 120000);

    // Convert messages to Ollama format
    const ollamaMessages = messages.map(msg => ({
      role: msg.role === 'tool' ? 'user' : msg.role,
      content: msg.content,
    }));

    const response = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages: ollamaMessages,
        stream: false,
        options: {
          temperature: 0.7,
          num_predict: 3000,
        },
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Ollama API error:', response.status, errorText);
      return {
        success: false,
        error: `Ollama error: ${response.statusText}`,
      };
    }

    const data = await response.json();
    return {
      success: true,
      response: data.message?.content || 'No response from AI',
    };

  } catch (error: any) {
    if (error.name === 'AbortError') {
      return { success: false, error: 'Request timed out' };
    }
    if (error.cause?.code === 'ECONNREFUSED') {
      return {
        success: false,
        error: `Cannot connect to Ollama at ${OLLAMA_BASE_URL}`,
      };
    }
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Build tools prompt for system message
 */
function buildToolsPrompt(tools: ToolDefinition[]): string {
  let prompt = '## Available Tools:\n\n';

  const categories = ['filesystem', 'code_execution', 'analysis', 'system'];

  for (const category of categories) {
    const categoryTools = tools.filter(t => t.category === category);
    if (categoryTools.length === 0) continue;

    prompt += `### ${category.replace('_', ' ').toUpperCase()}\n\n`;

    for (const tool of categoryTools) {
      prompt += `**${tool.name}** (${tool.securityLevel})\n`;
      prompt += `${tool.description}\n`;
      prompt += 'Parameters:\n';

      for (const param of tool.parameters) {
        const required = param.required ? 'required' : 'optional';
        prompt += `  - ${param.name} (${param.type}, ${required}): ${param.description}\n`;
      }

      prompt += '\n';
    }
  }

  return prompt;
}

/**
 * Parse tool calls from AI response
 */
function parseToolCalls(response: string): ToolCall[] {
  const toolCalls: ToolCall[] = [];
  const toolCallRegex = /TOOL_CALL:\s*(\w+)\s*PARAMETERS:\s*(\{[\s\S]*?\})/g;

  let match;
  while ((match = toolCallRegex.exec(response)) !== null) {
    try {
      const toolName = match[1].trim();
      const parametersStr = match[2].trim();
      const parameters = JSON.parse(parametersStr);

      toolCalls.push({
        id: `tool_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        name: toolName,
        parameters,
      });
    } catch (error) {
      console.error('Failed to parse tool call:', error);
    }
  }

  return toolCalls;
}

/**
 * Execute multiple tools
 */
async function executeTools(
  toolCalls: ToolCall[],
  context: ToolExecutionContext
): Promise<ToolResult[]> {
  const results: ToolResult[] = [];

  for (const toolCall of toolCalls) {
    try {
      const result = await executeTool(
        toolCall.name,
        toolCall.parameters,
        context
      );

      results.push({
        id: toolCall.id,
        name: toolCall.name,
        result: result.output,
        success: result.success,
        error: result.error,
      });
    } catch (error) {
      results.push({
        id: toolCall.id,
        name: toolCall.name,
        result: null,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  return results;
}

/**
 * Format tool results for AI
 */
function formatToolResults(results: ToolResult[]): string {
  let formatted = 'TOOL_RESULTS:\n\n';

  for (const result of results) {
    formatted += `Tool: ${result.name}\n`;
    formatted += `Status: ${result.success ? 'SUCCESS' : 'FAILED'}\n`;

    if (result.success) {
      formatted += `Result:\n${JSON.stringify(result.result, null, 2)}\n`;
    } else {
      formatted += `Error: ${result.error}\n`;
    }

    formatted += '\n---\n\n';
  }

  return formatted;
}
