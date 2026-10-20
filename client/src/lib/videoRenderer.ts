import { createDefaultVisualElements, isSceneReferenceText, VIDEO_STYLES, type Scene, type StyleId, type VisualColor, type VisualElement } from "./creator";

export type RenderOptions = {
  scenes: Scene[];
  styleId: StyleId;
  onProgress?: (value: number) => void;
  signal?: AbortSignal;
};

const WIDTH = 720;
const HEIGHT = 1280;
const FPS = 24;

function drawRoundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, lineHeight: number, maxLines: number) {
  const lines: string[] = [];
  for (const paragraph of text.split("\n")) {
    let line = "";
    for (const char of paragraph) {
      const next = line + char;
      if (line && ctx.measureText(next).width > maxWidth) {
        lines.push(line);
        line = char;
      } else {
        line = next;
      }
    }
    if (line) lines.push(line);
  }
  if (lines.length > maxLines) {
    lines.length = maxLines;
    lines[maxLines - 1] = `${lines[maxLines - 1].slice(0, -1)}…`;
  }
  return lines;
}

function colorFor(token: VisualColor, accent: string) {
  if (token === "accent") return accent;
  if (token === "warm") return "#f0a878";
  if (token === "cool") return "#74c8e8";
  if (token === "light") return "#f3f2ec";
  return "#92a8b8";
}

function drawVisualElement(ctx: CanvasRenderingContext2D, element: VisualElement, accent: string, progress: number) {
  const x = element.x * WIDTH;
  const y = element.y * HEIGHT;
  const width = element.width * WIDTH;
  const height = element.height * HEIGHT;
  const color = colorFor(element.color, accent);
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate((element.rotation * Math.PI) / 180 + Math.sin(progress * Math.PI * 2) * 0.025);
  ctx.strokeStyle = color;
  ctx.fillStyle = `${color}24`;
  ctx.lineWidth = Math.max(2, WIDTH * 0.003);
  ctx.shadowColor = color;
  ctx.shadowBlur = element.color === "muted" ? 0 : 18;

  if (element.type === "circle") {
    ctx.beginPath();
    ctx.ellipse(0, 0, Math.max(8, Math.abs(width) / 2), Math.max(8, Math.abs(height) / 2), 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  } else if (element.type === "rect") {
    drawRoundedRect(ctx, -Math.abs(width) / 2, -Math.abs(height) / 2, Math.max(12, Math.abs(width)), Math.max(12, Math.abs(height)), 18);
    ctx.fill();
    ctx.stroke();
  } else if (element.type === "line" || element.type === "arrow") {
    const dx = width / 2;
    const dy = height / 2;
    ctx.beginPath();
    ctx.moveTo(-dx, -dy);
    ctx.lineTo(dx, dy);
    ctx.stroke();
    if (element.type === "arrow") {
      const angle = Math.atan2(dy, dx);
      const head = 17;
      ctx.beginPath();
      ctx.moveTo(dx, dy);
      ctx.lineTo(dx - head * Math.cos(angle - Math.PI / 6), dy - head * Math.sin(angle - Math.PI / 6));
      ctx.moveTo(dx, dy);
      ctx.lineTo(dx - head * Math.cos(angle + Math.PI / 6), dy - head * Math.sin(angle + Math.PI / 6));
      ctx.stroke();
    }
  } else if (element.type === "text" && element.text) {
    ctx.shadowBlur = 0;
    ctx.fillStyle = color;
    ctx.font = "600 26px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(element.text.slice(0, 36), 0, 0, Math.min(WIDTH * 0.72, Math.max(100, Math.abs(width))));
  }
  ctx.restore();
}

export function drawSceneFrame(
  ctx: CanvasRenderingContext2D,
  scene: Scene,
  index: number,
  total: number,
  styleId: StyleId,
  progress = 0,
) {
  const style = VIDEO_STYLES.find(item => item.id === styleId) ?? VIDEO_STYLES[0];
  const background = ctx.createLinearGradient(0, 0, WIDTH, HEIGHT);
  background.addColorStop(0, style.dark);
  background.addColorStop(1, "#0b1020");
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  const accent = style.color;
  const padding = 64;
  ctx.fillStyle = accent;
  ctx.font = "600 20px system-ui, sans-serif";
  ctx.letterSpacing = "3px";
  ctx.fillText("VIBE FILM  /  FIELD NOTES", padding, 98);
  ctx.letterSpacing = "0px";
  ctx.fillStyle = "rgba(255,255,255,.42)";
  ctx.font = "500 17px system-ui, sans-serif";
  ctx.fillText(`${String(index + 1).padStart(2, "0")}  /  ${String(total).padStart(2, "0")}`, WIDTH - padding - 65, 98);

  drawRoundedRect(ctx, padding, 140, 80, 4, 2);
  ctx.fillStyle = accent;
  ctx.fill();

  // `scene.visual` is an editing note only. Never draw it or the scene title into preview/export.
  const sourceElements = scene.visualElements?.length ? scene.visualElements : createDefaultVisualElements(scene, index);
  const elements = sourceElements.filter(element => element.type !== "text" || !isSceneReferenceText(element.text ?? "", scene));
  elements.forEach(element => drawVisualElement(ctx, element, accent, progress));

  const narrativeY = HEIGHT - 330;
  ctx.fillStyle = accent;
  ctx.font = "500 17px system-ui, sans-serif";
  ctx.fillText("旁白 / NARRATION", padding, narrativeY);
  ctx.fillStyle = "#f8f7f4";
  ctx.font = "500 30px system-ui, sans-serif";
  const narrationLines = wrapText(ctx, scene.narration || "", WIDTH - padding * 2, 48, 4);
  narrationLines.forEach((line, lineIndex) => ctx.fillText(line, padding, narrativeY + 58 + lineIndex * 48));

  const progressY = HEIGHT - 72;
  drawRoundedRect(ctx, padding, progressY, WIDTH - padding * 2, 3, 2);
  ctx.fillStyle = "rgba(255,255,255,.18)";
  ctx.fill();
  drawRoundedRect(ctx, padding, progressY, (WIDTH - padding * 2) * Math.max(0, Math.min(1, (index + progress) / Math.max(1, total))), 3, 2);
  ctx.fillStyle = accent;
  ctx.fill();
}

function delay(ms: number) {
  return new Promise(resolve => window.setTimeout(resolve, ms));
}

export async function previewScenes(canvas: HTMLCanvasElement, options: RenderOptions) {
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("当前浏览器无法创建 Canvas 预览。");
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const scenes = options.scenes;
  if (!scenes.length) throw new Error("请先生成并确认分镜。");
  const sceneDuration = 1.25;
  const totalMs = scenes.length * sceneDuration * 1000;
  const startedAt = performance.now();
  options.onProgress?.(0);
  while (performance.now() - startedAt < totalMs) {
    if (options.signal?.aborted) return;
    const elapsed = performance.now() - startedAt;
    const sceneIndex = Math.min(scenes.length - 1, Math.floor(elapsed / (sceneDuration * 1000)));
    const localProgress = (elapsed / 1000 / sceneDuration) % 1;
    drawSceneFrame(ctx, scenes[sceneIndex], sceneIndex, scenes.length, options.styleId, localProgress);
    options.onProgress?.(elapsed / totalMs);
    await delay(1000 / FPS);
  }
  drawSceneFrame(ctx, scenes[scenes.length - 1], scenes.length - 1, scenes.length, options.styleId, 1);
  options.onProgress?.(1);
}

export async function renderWebM(canvas: HTMLCanvasElement, options: RenderOptions) {
  if (!canvas.captureStream || typeof MediaRecorder === "undefined") {
    throw new Error("当前浏览器暂不支持视频录制，请改用新版 Chrome、Edge 或 Firefox。");
  }
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("当前浏览器无法创建 Canvas 画布。");
  if (!options.scenes.length) throw new Error("请先生成并确认分镜。");
  canvas.width = WIDTH;
  canvas.height = HEIGHT;

  const stream = canvas.captureStream(FPS);
  const mimeType = ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"].find(type => MediaRecorder.isTypeSupported(type));
  const recorder = mimeType ? new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 2_500_000 }) : new MediaRecorder(stream);
  const chunks: BlobPart[] = [];
  const recording = new Promise<Blob>((resolve, reject) => {
    recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
    recorder.onerror = () => reject(new Error("视频录制中断，请重试。"));
    recorder.onstop = () => resolve(new Blob(chunks, { type: recorder.mimeType || "video/webm" }));
  });

  const durations = options.scenes.map(scene => Math.max(2, Math.min(15, Number(scene.duration) || 5)));
  const totalDuration = durations.reduce((sum, value) => sum + value, 0);
  const startTime = performance.now();
  let sceneIndex = 0;
  const drawFrame = () => {
    if (options.signal?.aborted) {
      if (recorder.state !== "inactive") recorder.stop();
      return;
    }
    const elapsedSeconds = (performance.now() - startTime) / 1000;
    if (elapsedSeconds >= totalDuration) {
      drawSceneFrame(ctx, options.scenes[options.scenes.length - 1], options.scenes.length - 1, options.scenes.length, options.styleId, 1);
      options.onProgress?.(1);
      if (recorder.state !== "inactive") recorder.stop();
      return;
    }
    let cursor = elapsedSeconds;
    sceneIndex = 0;
    while (sceneIndex < durations.length - 1 && cursor >= durations[sceneIndex]) {
      cursor -= durations[sceneIndex];
      sceneIndex += 1;
    }
    const localProgress = cursor / durations[sceneIndex];
    drawSceneFrame(ctx, options.scenes[sceneIndex], sceneIndex, options.scenes.length, options.styleId, localProgress);
    options.onProgress?.(elapsedSeconds / totalDuration);
    requestAnimationFrame(drawFrame);
  };

  recorder.start(250);
  requestAnimationFrame(drawFrame);
  try {
    return await recording;
  } finally {
    stream.getTracks().forEach(track => track.stop());
  }
}
