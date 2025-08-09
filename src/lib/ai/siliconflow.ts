/*
 * SiliconFlow Chat Completions 客户端
 * 文档: https://docs.siliconflow.cn/cn/api-reference/chat-completions/chat-completions
 */

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatResult {
  content: string;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
  raw?: any;
}

const DEFAULT_MODEL = 'Qwen/Qwen3-30B-A3B-Instruct-2507';

export async function siliconChat(
  messages: ChatMessage[],
  options?: {
    model?: string;
    temperature?: number;
    max_tokens?: number;
    baseURL?: string;
    apiKey?: string;
  }
): Promise<ChatResult> {
  const apiKey = options?.apiKey || process.env.SILICONFLOW_API_KEY;
  if (!apiKey) {
    throw new Error('缺少 SILICONFLOW_API_KEY 环境变量');
  }

  const body = {
    model: options?.model || DEFAULT_MODEL,
    messages,
    temperature: options?.temperature ?? 0.7,
    max_tokens: options?.max_tokens ?? 2048,
  };

  const resp = await fetch(options?.baseURL || 'https://api.siliconflow.cn/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    const text = await resp.text().catch(() => '');
    throw new Error(`SiliconFlow API 调用失败: ${resp.status} ${text}`);
  }

  const json = await resp.json();
  const content: string = json?.choices?.[0]?.message?.content ?? '';
  return {
    content,
    usage: json?.usage,
    raw: json,
  };
}


