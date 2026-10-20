import type { Express, Request, Response } from "express";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

type ModelInput = {
  baseUrl?: unknown;
  apiKey?: unknown;
  model?: unknown;
};

const WINDOW_MS = 60_000;
const MAX_REQUESTS_PER_WINDOW = 20;
const requestWindows = new Map<string, { startedAt: number; count: number }>();
const DEFAULT_UPSTREAM_TIMEOUT_MS = 25_000;
const CONNECTION_TEST_TIMEOUT_MS = 60_000;

function isPublicIPv4(address: string) {
  const parts = address.split(".").map(Number);
  if (parts.length !== 4 || parts.some(part => !Number.isInteger(part) || part < 0 || part > 255)) return false;
  const [a, b, c] = parts;
  if (a === 0 || a === 10 || a === 127 || a >= 224) return false;
  if (a === 169 && b === 254) return false;
  if (a === 172 && b >= 16 && b <= 31) return false;
  if (a === 192 && b === 168) return false;
  if (a === 100 && b >= 64 && b <= 127) return false;
  if (a === 192 && b === 0 && (c === 0 || c === 2)) return false;
  if (a === 198 && (b === 18 || b === 19 || b === 51)) return false;
  if (a === 203 && b === 0 && c === 113) return false;
  return true;
}

function isPublicIPv6(address: string) {
  const normalized = address.toLowerCase().split("%")[0];
  const halves = normalized.split("::");
  if (halves.length > 2) return false;
  const left = halves[0] ? halves[0].split(":") : [];
  const right = halves[1] ? halves[1].split(":") : [];
  const groups = [...left, ...Array(Math.max(0, 8 - left.length - right.length)).fill("0"), ...right];
  if (groups.length !== 8) return false;
  const values = groups.map(group => Number.parseInt(group || "0", 16));
  if (values.some(value => !Number.isInteger(value) || value < 0 || value > 0xffff)) return false;

  // IPv4-mapped IPv6 is evaluated using its embedded IPv4 address.
  if (values.slice(0, 5).every(value => value === 0) && values[5] === 0xffff) {
    const high = values[6];
    const low = values[7];
    return isPublicIPv4(`${high >> 8}.${high & 255}.${low >> 8}.${low & 255}`);
  }

  const first = values[0];
  if ((first & 0xe000) !== 0x2000) return false; // Global unicast only.
  if (first === 0x2001 && (values[1] === 0x0 || values[1] === 0x0db8)) return false;
  if (first === 0x2002) return false; // 6to4 can encapsulate private IPv4 destinations.
  return true;
}

function isPublicAddress(address: string) {
  const family = isIP(address);
  if (family === 4) return isPublicIPv4(address);
  if (family === 6) return isPublicIPv6(address);
  return false;
}

async function normalizePublicBaseUrl(value: unknown) {
  if (typeof value !== "string" || value.length > 500) throw new Error("请填写有效的 HTTPS API 地址。");
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    throw new Error("API 地址格式不正确，请使用 HTTPS 地址。");
  }
  if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash) {
    throw new Error("API 地址须为不带账号、查询参数或片段的 HTTPS 地址。");
  }
  if (url.port && url.port !== "443") throw new Error("出于安全考虑，模型 API 仅支持 HTTPS 默认端口 443。");
  if (isIP(url.hostname) || url.hostname === "localhost" || url.hostname.endsWith(".localhost") || url.hostname.endsWith(".local")) {
    throw new Error("API 地址须为可公开访问的 HTTPS 域名。");
  }

  let addresses: Array<{ address: string; family: number }>;
  try {
    addresses = await lookup(url.hostname, { all: true, verbatim: true });
  } catch {
    throw new Error("无法解析该 API 域名，请检查地址后重试。");
  }
  if (!addresses.length || addresses.some(entry => !isPublicAddress(entry.address))) {
    throw new Error("该 API 域名解析到非公网地址，已阻止请求。");
  }
  url.hash = "";
  return url.toString().replace(/\/+$/, "");
}

function validateCredentials(body: ModelInput) {
  if (typeof body.apiKey !== "string" || body.apiKey.trim().length < 4 || body.apiKey.length > 4096) {
    throw new Error("请填写有效的 API Key。");
  }
  if (body.model !== undefined && (typeof body.model !== "string" || !/^[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$/.test(body.model))) {
    throw new Error("模型名称格式不正确。");
  }
  return { apiKey: body.apiKey.trim(), model: typeof body.model === "string" ? body.model.trim() : "" };
}

function checkOrigin(req: Request, res: Response) {
  const origin = req.get("origin");
  if (!origin) return true;
  try {
    if (new URL(origin).host === req.get("host")) return true;
  } catch {
    // Invalid origin is rejected below.
  }
  res.status(403).json({ error: "跨站请求已阻止。" });
  return false;
}

function checkRateLimit(req: Request, res: Response) {
  const key = req.ip || req.socket.remoteAddress || "unknown";
  const now = Date.now();
  const current = requestWindows.get(key);
  if (!current || now - current.startedAt > WINDOW_MS) {
    requestWindows.set(key, { startedAt: now, count: 1 });
  } else if (current.count >= MAX_REQUESTS_PER_WINDOW) {
    res.status(429).json({ error: "请求较频繁，请稍等一分钟后再试。" });
    return false;
  } else {
    current.count += 1;
  }
  if (requestWindows.size > 5000) {
    for (const [address, window] of requestWindows) {
      if (now - window.startedAt > WINDOW_MS) requestWindows.delete(address);
    }
  }
  return true;
}

function safeUpstreamMessage(raw: string, apiKey: string) {
  let message = raw.slice(0, 800);
  if (apiKey) message = message.split(apiKey).join("[已隐藏]");
  return message.replace(/Bearer\s+[^\s"']+/gi, "Bearer [已隐藏]").replace(/<[^>]*>/g, " ").slice(0, 240);
}

async function requestUpstream(url: string, apiKey: string, init?: RequestInit, timeoutMs = DEFAULT_UPSTREAM_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      ...init,
      redirect: "manual",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: "application/json",
        ...(init?.headers ?? {}),
      },
    });
    if (response.status >= 300 && response.status < 400) return { status: response.status, ok: response.ok, text: "" };
    const reader = response.body?.getReader();
    if (!reader) return { status: response.status, ok: response.ok, text: "" };
    const chunks: Uint8Array[] = [];
    let total = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > 1_000_000) {
        await reader.cancel();
        throw new Error("模型服务返回内容过大，已停止读取。");
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return { status: response.status, ok: response.ok, text: new TextDecoder().decode(bytes) };
  } finally {
    clearTimeout(timeout);
  }
}

function extractMessage(payload: unknown) {
  if (!payload || typeof payload !== "object") return "";
  const choices = (payload as { choices?: Array<{ message?: { content?: unknown } }> }).choices;
  const content = choices?.[0]?.message?.content;
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content.map(part => part && typeof part === "object" && "text" in part ? String((part as { text: unknown }).text) : "").join("\n");
  }
  return "";
}

function parseJsonObject(text: string) {
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  const first = cleaned.indexOf("{");
  const last = cleaned.lastIndexOf("}");
  if (first < 0 || last <= first) throw new Error("模型返回内容不是有效 JSON，请更换模型或重试。");
  try {
    return JSON.parse(cleaned.slice(first, last + 1)) as unknown;
  } catch {
    throw new Error("模型返回的脚本结构无法解析，请重试。");
  }
}

function validateDraft(value: unknown) {
  if (!value || typeof value !== "object") throw new Error("模型返回内容缺少创作数据，请重试。");
  const item = value as Record<string, unknown>;
  if (typeof item.title !== "string" || !item.title.trim() || typeof item.summary !== "string" || typeof item.script !== "string" || !item.script.trim()) {
    throw new Error("模型返回内容缺少标题、简介或脚本，请更换模型或重试。");
  }
  if (!Array.isArray(item.scenes) || item.scenes.length < 3 || item.scenes.length > 8) {
    throw new Error("模型应返回 3 到 8 个分镜，请更换模型或重试。");
  }
  const scenes = item.scenes.map((scene, index) => {
    if (!scene || typeof scene !== "object") throw new Error(`第 ${index + 1} 个分镜格式不完整。`);
    const frame = scene as Record<string, unknown>;
    if ([frame.title, frame.visual, frame.narration].some(field => typeof field !== "string" || !String(field).trim())) {
      throw new Error(`第 ${index + 1} 个分镜缺少标题、画面或旁白。`);
    }
    const duration = Number(frame.duration);
    if (!Number.isFinite(duration) || duration < 2 || duration > 15) throw new Error(`第 ${index + 1} 个分镜时长须为 2–15 秒。`);
    return {
      id: `scene-${index + 1}`,
      title: String(frame.title).slice(0, 80),
      visual: String(frame.visual).slice(0, 240),
      narration: String(frame.narration).slice(0, 260),
      duration,
    };
  });
  return {
    title: item.title.trim().slice(0, 80),
    summary: item.summary.trim().slice(0, 240),
    script: item.script.trim().slice(0, 5000),
    scenes,
  };
}

export function registerCreatorApi(app: Express) {
  const guard = (req: Request, res: Response) => {
    res.set("Cache-Control", "no-store");
    if (!checkOrigin(req, res)) return false;
    if (!checkRateLimit(req, res)) return false;
    try {
      if (Buffer.byteLength(JSON.stringify(req.body ?? {}), "utf8") > 40_000) {
        res.status(413).json({ error: "请求内容过长，请精简后重试。" });
        return false;
      }
    } catch {
      res.status(400).json({ error: "请求格式无效。" });
      return false;
    }
    return true;
  };

  app.post("/api/creator/test", async (req, res) => {
    if (!guard(req, res)) return;
    let apiKey = "";
    try {
      const credentials = validateCredentials(req.body as ModelInput);
      apiKey = credentials.apiKey;
      if (!credentials.model) throw new Error("请先填写模型名称。");
      const baseUrl = await normalizePublicBaseUrl((req.body as ModelInput).baseUrl);
      const upstream = await requestUpstream(`${baseUrl}/chat/completions`, apiKey, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: credentials.model,
          messages: [{ role: "user", content: "Reply with only OK." }],
          max_tokens: 8,
          temperature: 0,
        }),
      }, CONNECTION_TEST_TIMEOUT_MS);
      if (upstream.status >= 300 && upstream.status < 400) {
        return res.status(502).json({ error: "API 地址返回了重定向，请填写最终 HTTPS 地址。" });
      }
      let result: unknown;
      try { result = JSON.parse(upstream.text); } catch { result = null; }
      if (!upstream.ok) {
        const providerError = result && typeof result === "object" ? (result as { error?: { message?: string } }).error?.message : undefined;
        const detail = typeof providerError === "string" ? safeUpstreamMessage(providerError, apiKey) : "";
        const hint = upstream.status === 404 ? "请检查 Base URL 的版本路径和模型名称。" : upstream.status === 401 || upstream.status === 403 ? "请检查 API Key、套餐专属 Key 及模型权限。" : "";
        const message = [detail || `模型服务返回 HTTP ${upstream.status}。`, hint].filter(Boolean).join(" ");
        return res.status(502).json({ error: `连接失败：${message}` });
      }
      const reply = extractMessage(result);
      if (!reply.trim()) return res.status(502).json({ error: "模型接口已响应，但没有返回可见文本；请检查所选模型的 Chat Completions 兼容性。" });
      return res.json({ ok: true, model: credentials.model });
    } catch (error) {
      if (error instanceof Error && (error.name === "AbortError" || /aborted/i.test(error.message))) {
        return res.status(504).json({ error: "模型连接测试等待超过 60 秒仍无响应；可能是服务商排队较久或接口暂不可用，请稍后重试。" });
      }
      const message = error instanceof Error ? safeUpstreamMessage(error.message, apiKey) : "模型连接失败，请检查设置。";
      return res.status(400).json({ error: message });
    }
  });

  app.post("/api/creator/generate", async (req, res) => {
    if (!guard(req, res)) return;
    let apiKey = "";
    try {
      const body = req.body as ModelInput & { idea?: unknown };
      const credentials = validateCredentials(body);
      apiKey = credentials.apiKey;
      if (!credentials.model) throw new Error("请先填写模型名称。");
      if (typeof body.idea !== "string" || !body.idea.trim() || body.idea.length > 2400) {
        throw new Error("请输入 1–2400 字的创作想法。");
      }
      const baseUrl = await normalizePublicBaseUrl(body.baseUrl);
      const systemPrompt = `你是一位中文知识短片编剧和分镜导演。请基于用户的选题创作一支适合代码动画呈现的知识短片。只返回 JSON，不要 Markdown，不要写前言。JSON 结构必须是：{"title":"片名","summary":"一句话简介","script":"可直接配音的完整中文旁白，约 180 到 420 个汉字，分段清楚","scenes":[{"title":"镜头标题","visual":"具体且适合用抽象图形/文字/简单几何动画呈现的画面描述","narration":"与本镜头对应的简短旁白","duration":5}] }。scenes 需有 4 到 7 个对象；duration 为 2 到 12 的秒数。信息表达准确、结构有起承转合，避免把无法核实的细节编造成事实。旁白在镜头间分配，不得全部重复。`;
      const upstream = await requestUpstream(`${baseUrl}/chat/completions`, apiKey, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: credentials.model,
          temperature: 0.7,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: `请围绕以下想法写脚本并拆分分镜：\n\n${body.idea.trim()}` },
          ],
        }),
      });
      if (upstream.status >= 300 && upstream.status < 400) return res.status(502).json({ error: "API 地址返回了重定向，请填写最终 HTTPS 地址。" });
      const raw = upstream.text;
      let payload: unknown;
      try { payload = JSON.parse(raw); } catch { payload = null; }
      if (!upstream.ok) {
        const providerError = payload && typeof payload === "object" ? (payload as { error?: { message?: string } }).error?.message : undefined;
        const message = typeof providerError === "string" ? safeUpstreamMessage(providerError, apiKey) : `模型服务返回 HTTP ${upstream.status}。`;
        return res.status(502).json({ error: `生成失败：${message}` });
      }
      const content = extractMessage(payload);
      if (!content.trim()) return res.status(502).json({ error: "模型返回空内容，请更换模型或重试。" });
      const draft = validateDraft(parseJsonObject(content));
      return res.json({ draft });
    } catch (error) {
      const message = error instanceof Error ? safeUpstreamMessage(error.message, apiKey) : "生成失败，请检查模型设置后重试。";
      return res.status(400).json({ error: message });
    }
  });
}
