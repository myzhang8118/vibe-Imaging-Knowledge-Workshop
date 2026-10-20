export type Scene = {
  id: string;
  title: string;
  visual: string;
  narration: string;
  duration: number;
};

export type GeneratedDraft = {
  title: string;
  summary: string;
  script: string;
  scenes: Scene[];
};

export type StyleId = "deep-space" | "archive" | "fable";

export type ModelSettings = {
  baseUrl: string;
  model: string;
};

export type CreatorDraft = {
  idea: string;
  title: string;
  summary: string;
  script: string;
  scenes: Scene[];
  styleId: StyleId;
  stage: number;
};

export const DEFAULT_MODEL_SETTINGS: ModelSettings = {
  baseUrl: "https://api.openai.com/v1",
  model: "",
};

export const VIDEO_STYLES: Array<{
  id: StyleId;
  title: string;
  subtitle: string;
  detail: string;
  color: string;
  dark: string;
}> = [
  { id: "deep-space", title: "深空档案", subtitle: "科学 · 未来", detail: "冷色粒子、轨道线与信息图形", color: "#73d7ed", dark: "#101d35" },
  { id: "archive", title: "金色档案", subtitle: "历史 · 纪实", detail: "旧纸色调、细线与胶片颗粒", color: "#f3bb69", dark: "#281c18" },
  { id: "fable", title: "纸上寓言", subtitle: "心理 · 行为", detail: "暖白画布、手绘圆形与柔和色块", color: "#f5a67c", dark: "#31201f" },
];

const DRAFT_STORAGE_KEY = "vibefilm.creatorDraft.v1";
const MODEL_STORAGE_KEY = "vibefilm.modelSettings.v1";

export function loadCreatorDraft(): CreatorDraft {
  const blank: CreatorDraft = { idea: "", title: "", summary: "", script: "", scenes: [], styleId: "deep-space", stage: 0 };
  try {
    const raw = localStorage.getItem(DRAFT_STORAGE_KEY);
    if (!raw) return blank;
    const parsed = JSON.parse(raw) as Partial<CreatorDraft>;
    const scenes = Array.isArray(parsed.scenes)
      ? parsed.scenes.filter((scene): scene is Scene => Boolean(scene && typeof scene.id === "string" && typeof scene.title === "string" && typeof scene.visual === "string" && typeof scene.narration === "string" && Number.isFinite(Number(scene.duration))))
      : [];
    const styleId = VIDEO_STYLES.some(style => style.id === parsed.styleId) ? parsed.styleId as StyleId : "deep-space";
    const stage = Number.isInteger(parsed.stage) ? Math.max(0, Math.min(4, Number(parsed.stage))) : 0;
    return {
      idea: typeof parsed.idea === "string" ? parsed.idea.slice(0, 2400) : "",
      title: typeof parsed.title === "string" ? parsed.title.slice(0, 80) : "",
      summary: typeof parsed.summary === "string" ? parsed.summary.slice(0, 240) : "",
      script: typeof parsed.script === "string" ? parsed.script.slice(0, 5000) : "",
      scenes,
      styleId,
      stage,
    };
  } catch {
    return blank;
  }
}

export function saveCreatorDraft(draft: CreatorDraft) {
  try {
    // Model credentials are intentionally not part of the CreatorDraft type or stored payload.
    localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft));
  } catch {
    // Storage can be unavailable or full; the current page state remains usable.
  }
}

export function loadModelSettings(): ModelSettings {
  try {
    const parsed = JSON.parse(localStorage.getItem(MODEL_STORAGE_KEY) || "null") as Partial<ModelSettings> | null;
    return {
      baseUrl: typeof parsed?.baseUrl === "string" ? parsed.baseUrl : DEFAULT_MODEL_SETTINGS.baseUrl,
      model: typeof parsed?.model === "string" ? parsed.model : DEFAULT_MODEL_SETTINGS.model,
    };
  } catch {
    return DEFAULT_MODEL_SETTINGS;
  }
}

export function saveModelSettings(settings: ModelSettings) {
  try {
    localStorage.setItem(MODEL_STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Non-secret connection fields are optional convenience settings.
  }
}

export function clearCreatorDraft() {
  try { localStorage.removeItem(DRAFT_STORAGE_KEY); } catch { /* ignore */ }
}

export async function testModelConnection(settings: ModelSettings, apiKey: string) {
  const response = await fetch("/api/creator/test", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
    body: JSON.stringify({ ...settings, apiKey }),
  });
  const payload = await response.json().catch(() => ({})) as { ok?: boolean; model?: string; error?: string };
  if (!response.ok || !payload.ok) throw new Error(payload.error || `连接失败（HTTP ${response.status}）`);
  return { model: payload.model ?? settings.model };
}

export async function generateDraft(settings: ModelSettings, apiKey: string, idea: string): Promise<GeneratedDraft> {
  const response = await fetch("/api/creator/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
    body: JSON.stringify({ ...settings, apiKey, idea }),
  });
  const payload = await response.json().catch(() => ({})) as { draft?: GeneratedDraft; error?: string };
  if (!response.ok || !payload.draft) throw new Error(payload.error || `脚本生成失败（HTTP ${response.status}）`);
  return payload.draft;
}
