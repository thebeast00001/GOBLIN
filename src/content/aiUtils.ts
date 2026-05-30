export type AIProvider = 'openai' | 'claude' | 'openrouter' | 'ollama' | 'gemini';

export async function performWebSearch(query: string): Promise<string> {
  try {
    const searchUrl = `https://lite.duckduckgo.com/lite/?q=${encodeURIComponent(query)}`;
    const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(searchUrl)}`;
    
    const response = await fetch(proxyUrl);
    const data = await response.json();
    const html = data.contents;
    
    // Parse DuckDuckGo Lite HTML (results are typically in table rows with class 'result-snippet')
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    
    const snippets = Array.from(doc.querySelectorAll('.result-snippet'))
      .slice(0, 4)
      .map(el => el.textContent?.trim())
      .filter(Boolean);
      
    if (snippets.length === 0) return "Search returned no reliable results.";
    return snippets.join('\n\n');
  } catch (error) {
    console.error("Search failed:", error);
    return "Web search failed due to network error.";
  }
}

export interface AISettings {
  provider: AIProvider;
  apiKey: string;
  model: string;
  baseUrl?: string; // mostly for Ollama
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  text: string;
  images?: string[]; // Array of base64 data URLs
}

export async function chatWithVideo(
  transcriptText: string,
  videoMetadata: { title: string, channelName: string, description: string },
  chatHistory: ChatMessage[],
  settings: AISettings
): Promise<string> {
  
  const MAX_TRANSCRIPT_CHARS = 300000;
  let safeTranscript = transcriptText || "";
  if (safeTranscript.length > MAX_TRANSCRIPT_CHARS) {
    safeTranscript = safeTranscript.substring(0, MAX_TRANSCRIPT_CHARS) + "\n\n[...TRANSCRIPT TRUNCATED DUE TO LLM CONTEXT LENGTH LIMITS...]";
  }

  const systemPrompt = `--- SYSTEM INSTRUCTIONS ---
You are GOBLIN, an expert educational AI assistant designed to help users learn from YouTube videos. 
Do NOT confuse your identity (GOBLIN) with the people in the video. You are an external observer analyzing the transcript.

--- VIDEO METADATA ---
Title: ${videoMetadata.title || 'Unknown Title'}
Channel Name: ${videoMetadata.channelName || 'Unknown Channel'}
Description: ${(videoMetadata.description || '').substring(0, 500)}...

--- VIDEO TRANSCRIPT ---
(If this is empty, rely entirely on the Video Metadata to answer questions)
Note: All timestamps are strictly formatted as [HH:MM:SS] (Hours:Minutes:Seconds). For example, [00:01:40] is 1 minute and 40 seconds. [01:40:23] is 1 hour, 40 minutes, and 23 seconds.
${safeTranscript}

--- YOUR TASKS ---
1. Identity: You are GOBLIN. If the user asks for your name or identity, proudly introduce yourself as GOBLIN, an incredibly intelligent AI companion.
2. Conversational & General Intelligence: You are fully capable of answering general knowledge questions, just like ChatGPT. You don't only talk about the video. Respond smartly to whatever the user asks.
3. Greetings: If the user just says "hello", reply with a friendly greeting and ask how you can help. DO NOT summarize the video unless explicitly asked!
4. Deep Summarization: When the user DOES ask for a summary of the video, provide an EXTREMELY detailed, comprehensive, and insightful breakdown. Don't just give a basic summary; extract the core concepts, deep insights, and highly valuable takeaways.
5. Formatting: Be highly readable! Format your answers beautifully using Markdown (bolding, inline code, bullet points, headings, and emojis).
6. **TIMESTAMP RANGES:** If the user asks to summarize a specific range (e.g., "up to 6:18" or "from 3:14 to 1:09:14"), you MUST look at the transcript timestamps and summarize ONLY the content within that specific time range!
7. **V2 QUICK ENGINES:** If the user asks for:
   - "Cut the Fluff": Bypass ALL intros, sponsorships, and rambling. Find the exact answer to the video's title and state it directly in 2-3 sentences.
   - "Extract Checklist": Convert the video's core advice into a highly actionable, numbered step-by-step checklist.
   - "Viral Clips": Analyze the emotional peaks and best quotes. Return EXACTLY 3 highly engaging segments, including the exact timestamp range and a brief explanation of why it would go viral.
   - "Explain Like I'm 5": Break down the core concepts into extremely simple, intuitive analogies suitable for a 5-year-old.
8. **CONTEXT SWITCHING:** If the user asks for a Checklist, and then in the next message asks for Viral Clips, YOU MUST completely switch your task! Do NOT combine them. Treat each new command as the absolute priority over past messages.
9. **WEB SEARCH GROUNDING:** If you are asked to identify a person, object, or fact that is NOT explicitly mentioned in the video metadata or transcript, OR if you do not know the answer, you MUST autonomously search the web. To trigger a search, you must output EXACTLY and ONLY this token: \`[SEARCH: "your specific search query"]\`. Do not include any other text.`;

  try {
    return await executeChatRouting(systemPrompt, chatHistory, settings);
  } catch (err: any) {
    const errorMsg = err.message?.toLowerCase() || '';
    // If the model rejects the image (e.g., OpenRouter "No endpoints found that support image input")
    if (errorMsg.includes('image') || errorMsg.includes('vision') || errorMsg.includes('endpoints found')) {
      console.warn(`[GOBLIN] Model ${settings.model} rejected image payload. Falling back to text-only mode...`);
      const textOnlyHistory = chatHistory.map(msg => ({ ...msg, images: undefined }));
      return await executeChatRouting(systemPrompt, textOnlyHistory, settings);
    }
    console.error('AI Chat Error:', err);
    throw new Error(err.message || 'Failed to generate response');
  }
}

async function executeChatRouting(systemPrompt: string, history: ChatMessage[], settings: AISettings): Promise<string> {
  switch (settings.provider) {
    case 'openai':
      return await callOpenAIChat(systemPrompt, history, settings);
    case 'claude':
      return await callClaudeChat(systemPrompt, history, settings);
    case 'openrouter':
      return await callOpenRouterChat(systemPrompt, history, settings);
    case 'ollama':
      return await callOllamaChat(systemPrompt, history, settings);
    case 'gemini':
      return await callGeminiChat(systemPrompt, history, settings);
    default:
      throw new Error('Unsupported provider');
  }
}

function formatMessagesForOpenAI(system: string, history: ChatMessage[]) {
  return [
    { role: 'system', content: system },
    ...history.map(msg => {
      if (msg.images && msg.images.length > 0) {
        return {
          role: msg.role,
          content: [
            { type: 'text', text: msg.text },
            ...msg.images.map(img => ({ type: 'image_url', image_url: { url: img } }))
          ]
        };
      }
      return { role: msg.role, content: msg.text };
    })
  ];
}

async function callOpenAIChat(system: string, history: ChatMessage[], settings: AISettings) {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${settings.apiKey}`
    },
    body: JSON.stringify({
      model: settings.model || 'gpt-4o-mini',
      messages: formatMessagesForOpenAI(system, history)
    })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || 'OpenAI API Error');
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

async function callClaudeChat(system: string, history: ChatMessage[], settings: AISettings) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': settings.apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true'
    },
    body: JSON.stringify({
      model: settings.model || 'claude-3-haiku-20240307',
      max_tokens: 2000,
      system: system,
      messages: history.map(msg => {
        if (msg.images && msg.images.length > 0) {
          return {
            role: msg.role,
            content: [
              { type: 'text', text: msg.text },
              ...msg.images.map(img => {
                const base64Data = img.split(',')[1];
                const mediaType = img.split(';')[0].split(':')[1];
                return { type: 'image', source: { type: 'base64', media_type: mediaType || 'image/jpeg', data: base64Data } };
              })
            ]
          };
        }
        return { role: msg.role, content: msg.text };
      })
    })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || 'Claude API Error');
  }

  const data = await response.json();
  return data.content[0].text;
}

async function callOpenRouterChat(system: string, history: ChatMessage[], settings: AISettings, retries = 2): Promise<string> {
  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${settings.apiKey}`,
        'HTTP-Referer': 'https://github.com/goblin-extension',
        'X-Title': 'GOBLIN'
      },
      body: JSON.stringify({
        model: settings.model || 'google/gemini-2.5-flash',
        messages: formatMessagesForOpenAI(system, history),
        route: 'fallback' // Tells OpenRouter to automatically fallback to other providers if the primary one fails
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error?.message || `HTTP ${response.status} Error`);
    }

    const data = await response.json();
    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
      throw new Error("Invalid response payload from OpenRouter.");
    }
    return data.choices[0].message.content;
  } catch (err: any) {
    const errMsg = err.message || '';
    if (retries > 0 && (errMsg.toLowerCase().includes('provider') || errMsg.toLowerCase().includes('timeout') || errMsg.includes('502'))) {
      console.warn(`[OpenRouter] Upstream provider error encountered. Retrying... (${retries} attempts left)`);
      await new Promise(resolve => setTimeout(resolve, 1500));
      return callOpenRouterChat(system, history, settings, retries - 1);
    }
    throw new Error(`OpenRouter Model Error: ${errMsg}. If this persists, please switch to a different model in Settings.`);
  }
}

async function callOllamaChat(system: string, history: ChatMessage[], settings: AISettings) {
  const baseUrl = settings.baseUrl || 'http://localhost:11434';
  const response = await fetch(`${baseUrl}/api/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: settings.model || 'llama3',
      messages: [
        { role: 'system', content: system },
        ...history.map(msg => ({
          role: msg.role,
          content: msg.text,
          ...(msg.images && msg.images.length > 0 ? { images: msg.images.map(img => img.split(',')[1]) } : {})
        }))
      ],
      stream: false
    })
  });

  if (!response.ok) {
    throw new Error('Ollama API Error. Ensure Ollama is running and CORS is configured.');
  }

  const data = await response.json();
  return data.message.content;
}

async function callGeminiChat(system: string, history: ChatMessage[], settings: AISettings) {
  const model = settings.model || 'gemini-1.5-pro';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${settings.apiKey}`;
  
  const contents = history.map(msg => {
    const parts: any[] = [{ text: msg.text }];
    if (msg.images && msg.images.length > 0) {
      msg.images.forEach(img => {
        const base64Data = img.split(',')[1];
        const mediaType = img.split(';')[0].split(':')[1] || 'image/jpeg';
        parts.push({
          inline_data: {
            mime_type: mediaType,
            data: base64Data
          }
        });
      });
    }
    return {
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts
    };
  });

  const body = {
    system_instruction: {
      parts: [{ text: system }]
    },
    contents: contents,
    tools: [
      { google_search: {} }
    ]
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || 'Gemini API Error');
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  
  // Append grounding citations if they exist
  const groundingMetadata = data.candidates?.[0]?.groundingMetadata;
  if (groundingMetadata && groundingMetadata.groundingChunks) {
    const urls = groundingMetadata.groundingChunks.map((chunk: any) => chunk.web?.uri).filter(Boolean);
    const uniqueUrls = [...new Set(urls)];
    if (uniqueUrls.length > 0) {
      return text + '\n\n---\n**Sources:**\n' + uniqueUrls.map((u: any) => `- [${new URL(u).hostname}](${u})`).join('\n');
    }
  }

  return text;
}
