import { VIDEO_STYLES, type Scene, type StyleId } from "./creator";

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
  const hue = (index * 67 + 18) % 360;
  ctx.save();
  ctx.globalAlpha = 0.17;
  ctx.fillStyle = `hsl(${hue} 75% 60%)`;
  ctx.beginPath();
  ctx.arc(555 - (index % 2) * 80, 330 + Math.sin(progress * Math.PI * 2) * 26, 182 + Math.sin(progress * Math.PI) * 20, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 0.45;
  ctx.strokeStyle = accent;
  ctx.lineWidth = 1.5;
  for (let ring = 0; ring < 3; ring += 1) {
    ctx.beginPath();
    ctx.ellipse(360, 350, 128 + ring * 34, 40 + ring * 13, -0.42 + progress * 0.15, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();

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

  ctx.fillStyle = "rgba(255,255,255,.50)";
  ctx.font = "500 19px system-ui, sans-serif";
  const title = scene.title || `镜头 ${index + 1}`;
  ctx.fillText(title.slice(0, 24), padding, 232);

  ctx.fillStyle = "#f6f4ef";
  ctx.font = "700 51px system-ui, sans-serif";
  const visualLines = wrapText(ctx, scene.visual || "画面待补充", WIDTH - padding * 2, 72, 5);
  visualLines.forEach((line, lineIndex) => ctx.fillText(line, padding, 318 + lineIndex * 72));

  const shapeY = Math.min(720, 500 + visualLines.length * 54);
  ctx.save();
  ctx.translate(WIDTH / 2, shapeY + 70);
  ctx.rotate(-0.08 + progress * 0.05);
  drawRoundedRect(ctx, -138, -96, 276, 192, 20);
  ctx.fillStyle = "rgba(255,255,255,.045)";
  ctx.fill();
  ctx.strokeStyle = `${accent}8a`;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = accent;
  ctx.font = "600 22px system-ui, sans-serif";
  ctx.textAlign = "center";
  const visualCaption = scene.visual || "画面构想";
  const captionLines = wrapText(ctx, visualCaption, 220, 32, 3);
  captionLines.forEach((line, lineIndex) => ctx.fillText(line, 0, -12 + lineIndex * 32));
  ctx.restore();

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
