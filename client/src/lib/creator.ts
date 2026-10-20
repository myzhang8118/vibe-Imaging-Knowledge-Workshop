export type VisualElementType = "circle" | "rect" | "line" | "arrow" | "text";
export type VisualColor = "accent" | "warm" | "cool" | "light" | "muted";

export type VisualElement = {
  id: string;
  type: VisualElementType;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  color: VisualColor;
  text?: string;
};

export type Scene = {
  id: string;
  title: string;
  visual: string;
  visualElements: VisualElement[];
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

export type AiAssistStage = "idea" | "script" | "scene" | "visual" | "storyboard" | "style" | "final";

export type AiAssistRequest = {
  stage: AiAssistStage;
  instruction: string;
  draft: CreatorDraft;
  sceneId?: string;
};

export type AiAssistSuggestion =
  | { stage: "idea"; idea: string; explanation: string }
  | { stage: "script"; title: string; summary: string; script: string; explanation: string }
  | { stage: "scene"; scene: Scene; explanation: string }
  | { stage: "visual"; scene: Scene; explanation: string }
  | { stage: "storyboard"; scenes: Scene[]; explanation: string }
  | { stage: "style"; styleId: StyleId; explanation: string }
  | { stage: "final"; title: string; summary: string; script: string; scenes: Scene[]; styleId: StyleId; explanation: string };

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

const VISUAL_TYPES = new Set<VisualElementType>(["circle", "rect", "line", "arrow", "text"]);
const VISUAL_COLORS = new Set<VisualColor>(["accent", "warm", "cool", "light", "muted"]);

export function isSceneReferenceText(text: string, scene: Pick<Scene, "title" | "visual">) {
  const normalizedText = text.trim().toLocaleLowerCase();
  if (!normalizedText) return false;
  return [scene.title, scene.visual].some(reference => {
    const normalizedReference = reference.trim().toLocaleLowerCase();
    return normalizedText === normalizedReference || (normalizedReference.length >= 6 && (normalizedReference.includes(normalizedText) || normalizedText.includes(normalizedReference)));
  });
}

export function createDefaultVisualElements(scene: Pick<Scene, "title" | "visual">, index = 0): VisualElement[] {
  const description = `${scene.title} ${scene.visual}`;
  if (/数据|增长|趋势|变化|比例|统计|上升|下降|chart|trend/i.test(description)) {
    return [
      { id: `base-${index}-axis`, type: "line", x: 0.5, y: 0.58, width: 0.56, height: 0, rotation: 0, color: "muted" },
      { id: `base-${index}-bar-a`, type: "rect", x: 0.32, y: 0.49, width: 0.1, height: 0.18, rotation: 0, color: "cool" },
      { id: `base-${index}-bar-b`, type: "rect", x: 0.49, y: 0.4, width: 0.1, height: 0.36, rotation: 0, color: "accent" },
      { id: `base-${index}-bar-c`, type: "rect", x: 0.66, y: 0.4, width: 0.1, height: 0.36, rotation: 0, color: "warm" },
      { id: `base-${index}-trend`, type: "arrow", x: 0.52, y: 0.34, width: 0.38, height: -0.22, rotation: 0, color: "light" },
    ];
  }
  if (/对比|比较|两种|差异|选择|平衡|compare|versus/i.test(description)) {
    return [
      { id: `base-${index}-left`, type: "circle", x: 0.32, y: 0.43, width: 0.22, height: 0.22, rotation: 0, color: "cool" },
      { id: `base-${index}-right`, type: "circle", x: 0.68, y: 0.43, width: 0.22, height: 0.22, rotation: 0, color: "warm" },
      { id: `base-${index}-join`, type: "line", x: 0.5, y: 0.43, width: 0.18, height: 0, rotation: 0, color: "light" },
      { id: `base-${index}-center`, type: "circle", x: 0.5, y: 0.43, width: 0.08, height: 0.08, rotation: 0, color: "accent" },
    ];
  }
  return [
    { id: `base-${index}-orbit`, type: "circle", x: 0.5, y: 0.42, width: 0.36, height: 0.22, rotation: -22, color: "muted" },
    { id: `base-${index}-core`, type: "circle", x: 0.5, y: 0.42, width: 0.18, height: 0.18, rotation: 0, color: "accent" },
    { id: `base-${index}-satellite-a`, type: "circle", x: 0.31, y: 0.3, width: 0.08, height: 0.08, rotation: 0, color: "warm" },
    { id: `base-${index}-satellite-b`, type: "circle", x: 0.69, y: 0.54, width: 0.07, height: 0.07, rotation: 0, color: "cool" },
    { id: `base-${index}-connector`, type: "line", x: 0.5, y: 0.42, width: 0.42, height: 0.18, rotation: 0, color: "muted" },
  ];
}

export function normalizeVisualElements(value: unknown, scene: Pick<Scene, "title" | "visual">, index = 0): VisualElement[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > 10) return createDefaultVisualElements(scene, index);
  const elements: VisualElement[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const candidate = item as Record<string, unknown>;
    if (typeof candidate.id !== "string" || !candidate.id || candidate.id.length > 80) continue;
    if (typeof candidate.type !== "string" || !VISUAL_TYPES.has(candidate.type as VisualElementType)) continue;
    if (typeof candidate.color !== "string" || !VISUAL_COLORS.has(candidate.color as VisualColor)) continue;
    const x = Number(candidate.x); const y = Number(candidate.y);
    const width = Number(candidate.width); const height = Number(candidate.height); const rotation = Number(candidate.rotation);
    if (![x, y, width, height, rotation].every(Number.isFinite) || x - Math.abs(width) / 2 < 0.06 || x + Math.abs(width) / 2 > 0.94 || y - Math.abs(height) / 2 < 0.13 || y + Math.abs(height) / 2 > 0.72 || Math.abs(width) > 0.8 || Math.abs(height) > 0.8 || Math.abs(rotation) > 360) continue;
    if (candidate.type === "text" && (typeof candidate.text !== "string" || !candidate.text.trim() || candidate.text.length > 24 || isSceneReferenceText(candidate.text, scene))) continue;
    elements.push({
      id: candidate.id,
      type: candidate.type as VisualElementType,
      x, y, width, height, rotation,
      color: candidate.color as VisualColor,
      ...(candidate.type === "text" ? { text: String(candidate.text).trim() } : {}),
    });
  }
  return elements.length ? elements : createDefaultVisualElements(scene, index);
}

const DRAFT_STORAGE_KEY = "vibefilm.creatorDraft.v2";
const LEGACY_DRAFT_STORAGE_KEY = "vibefilm.creatorDraft.v1";
const MODEL_STORAGE_KEY = "vibefilm.modelSettings.v1";

export function loadCreatorDraft(): CreatorDraft {
  const blank: CreatorDraft = { idea: "", title: "", summary: "", script: "", scenes: [], styleId: "deep-space", stage: 0 };
  try {
    const currentRaw = localStorage.getItem(DRAFT_STORAGE_KEY);
    const isLegacyDraft = !currentRaw;
    const raw = currentRaw ?? localStorage.getItem(LEGACY_DRAFT_STORAGE_KEY);
    if (!raw) return blank;
    const parsed = JSON.parse(raw) as Partial<CreatorDraft>;
    const scenes = Array.isArray(parsed.scenes)
      ? parsed.scenes.filter((scene): scene is Scene => Boolean(scene && typeof scene.id === "string" && typeof scene.title === "string" && typeof scene.visual === "string" && typeof scene.narration === "string" && Number.isFinite(Number(scene.duration))))
        .map((scene, index) => ({ ...scene, visualElements: normalizeVisualElements((scene as Partial<Scene>).visualElements, scene, index) }))
      : [];
    const styleId = VIDEO_STYLES.some(style => style.id === parsed.styleId) ? parsed.styleId as StyleId : "deep-space";
    const storedStage = Number.isInteger(parsed.stage) ? Math.max(0, Math.min(isLegacyDraft ? 4 : 5, Number(parsed.stage))) : 0;
    const stage = isLegacyDraft && storedStage >= 3 ? storedStage + 1 : storedStage;
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
  try {
    localStorage.removeItem(DRAFT_STORAGE_KEY);
    localStorage.removeItem(LEGACY_DRAFT_STORAGE_KEY);
  } catch { /* ignore */ }
}

export async function testModelConnection(settings: ModelSettings, apiKey: string) {
  const response = await fetch("/api/creator/test", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
    body: JSON.stringify({ ...settings, apiKey }),
  });
  const payload = await response.json().catch(() => ({})) as { ok?: boolean; model?: string; error?: string; warning?: string };
  if (!response.ok || !payload.ok) throw new Error(payload.error || `连接失败（HTTP ${response.status}）`);
  return { model: payload.model ?? settings.model, warning: payload.warning };
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
  return {
    ...payload.draft,
    scenes: payload.draft.scenes.map((scene, index) => ({
      ...scene,
      visualElements: normalizeVisualElements(scene.visualElements, scene, index),
    })),
  };
}

export async function requestAiAssist(settings: ModelSettings, apiKey: string, request: AiAssistRequest): Promise<AiAssistSuggestion> {
  const response = await fetch("/api/creator/assist", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
    body: JSON.stringify({ ...settings, apiKey, ...request }),
  });
  const payload = await response.json().catch(() => ({})) as { suggestion?: AiAssistSuggestion; error?: string };
  if (!response.ok || !payload.suggestion || payload.suggestion.stage !== request.stage) {
    throw new Error(payload.error || `AI 修改失败（HTTP ${response.status}）`);
  }
  return payload.suggestion;
}
