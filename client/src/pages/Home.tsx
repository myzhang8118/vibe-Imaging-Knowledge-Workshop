import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Check,
  ChevronRight,
  Clapperboard,
  Clock3,
  Download,
  Eye,
  EyeOff,
  FileText,
  Film,
  Layers3,
  LoaderCircle,
  LockKeyhole,
  Play,
  Plus,
  RefreshCw,
  Settings2,
  Sparkles,
  Wifi,
  X,
} from "lucide-react";
import {
  DEFAULT_MODEL_SETTINGS,
  VIDEO_STYLES,
  clearCreatorDraft,
  generateDraft,
  loadCreatorDraft,
  loadModelSettings,
  saveCreatorDraft,
  saveModelSettings,
  testModelConnection,
  type CreatorDraft,
  type ModelSettings,
  type Scene,
  type StyleId,
} from "@/lib/creator";
import { previewScenes, renderWebM } from "@/lib/videoRenderer";

type Step = { number: number; label: string; icon: typeof Sparkles };
const STEPS: Step[] = [
  { number: 0, label: "想法", icon: Sparkles },
  { number: 1, label: "脚本", icon: FileText },
  { number: 2, label: "分镜", icon: Layers3 },
  { number: 3, label: "风格", icon: Eye },
  { number: 4, label: "成片", icon: Clapperboard },
];

function getStyle(styleId: StyleId) {
  return VIDEO_STYLES.find(style => style.id === styleId) ?? VIDEO_STYLES[0];
}

function getDuration(scenes: Scene[]) {
  return scenes.reduce((total, scene) => total + Math.max(2, Number(scene.duration) || 0), 0);
}

function formatDuration(value: number) {
  const minutes = Math.floor(value / 60);
  const seconds = Math.round(value % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function getStoryStatus(stage: number, scenes: Scene[], idea: string) {
  if (!idea.trim()) return "等待灵感";
  if (stage === 0) return "准备开始";
  if (stage === 4 && scenes.length > 0) return "待生成成片";
  return "创作进行中";
}

function ModelSettingsDialog({
  open,
  onClose,
  settings,
  setSettings,
  apiKey,
  setApiKey,
}: {
  open: boolean;
  onClose: () => void;
  settings: ModelSettings;
  setSettings: (value: ModelSettings) => void;
  apiKey: string;
  setApiKey: (value: string) => void;
}) {
  const [visible, setVisible] = useState(false);
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<{ tone: "success" | "error" | "idle"; text: string }>({ tone: "idle", text: "" });

  useEffect(() => {
    if (open) {
      setResult({ tone: "idle", text: "" });
      setVisible(false);
    }
  }, [open]);

  if (!open) return null;

  const testConnection = async () => {
    if (!apiKey.trim()) {
      setResult({ tone: "error", text: "先填写 API Key，再测试连通性。" });
      return;
    }
    setChecking(true);
    setResult({ tone: "idle", text: "正在发送最短模型请求…" });
    try {
      const response = await testModelConnection(settings, apiKey);
      setResult({ tone: "success", text: `连接成功。模型 ${response.model} 已返回有效回复。` });
      saveModelSettings(settings);
    } catch (error) {
      setResult({ tone: "error", text: error instanceof Error ? error.message : "连接失败，请检查地址与密钥。" });
    } finally {
      setChecking(false);
    }
  };

  const saveAndClose = () => {
    saveModelSettings(settings);
    setResult({ tone: "idle", text: "" });
    onClose();
  };

  return (
    <div className="modal-scrim" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="settings-modal" role="dialog" aria-modal="true" aria-labelledby="settings-title">
        <div className="modal-topline">
          <div className="modal-symbol"><Settings2 size={20} /></div>
          <button className="icon-button modal-close" onClick={onClose} aria-label="关闭模型配置"><X size={18} /></button>
        </div>
        <p className="eyebrow">连接你的创作引擎</p>
        <h2 id="settings-title">模型 API 配置</h2>
        <p className="modal-description">支持 OpenAI Chat Completions 兼容接口。配置后可测试连接，并用模型生成真实脚本与分镜。</p>
        <span className="field-hint">连接测试会实际调用所选模型，最多生成 8 个输出 Token；服务商可能收取少量费用。</span>

        <label className="field-label" htmlFor="base-url">API Base URL</label>
        <input
          id="base-url"
          className="text-input"
          value={settings.baseUrl}
          onChange={event => { setSettings({ ...settings, baseUrl: event.target.value }); setResult({ tone: "idle", text: "" }); }}
          placeholder="https://api.openai.com/v1"
          autoComplete="url"
          spellCheck={false}
        />
        <span className="field-hint">示例：OpenAI、DeepSeek、通义千问等兼容服务的接口地址。</span>

        <label className="field-label" htmlFor="model-name">模型名称</label>
        <input
          id="model-name"
          className="text-input"
          value={settings.model}
          onChange={event => { setSettings({ ...settings, model: event.target.value }); setResult({ tone: "idle", text: "" }); }}
          placeholder="例如 gpt-4o-mini"
          autoComplete="off"
          spellCheck={false}
        />

        <label className="field-label" htmlFor="api-key">API Key</label>
        <div className="secret-input-wrap">
          <LockKeyhole size={16} className="secret-prefix" />
          <input
            id="api-key"
            className="text-input secret-input"
            value={apiKey}
            onChange={event => { setApiKey(event.target.value); setResult({ tone: "idle", text: "" }); }}
            placeholder="粘贴你的 API Key"
            type={visible ? "text" : "password"}
            autoComplete="new-password"
            spellCheck={false}
          />
          <button className="icon-button secret-toggle" onClick={() => setVisible(!visible)} aria-label={visible ? "隐藏 API Key" : "显示 API Key"}>
            {visible ? <EyeOff size={17} /> : <Eye size={17} />}
          </button>
        </div>
        <div className="privacy-note"><LockKeyhole size={14} /><span>仅在当前页面内存中使用，刷新后需重新输入；不会写入浏览器存储或服务日志。</span></div>

        {result.text && <div className={`connection-result ${result.tone}`} role="status">{checking && <LoaderCircle size={15} className="spin" />}{!checking && result.tone === "success" && <Check size={15} />}{!checking && result.tone === "error" && <X size={15} />}{result.text}</div>}

        <div className="modal-actions">
          <button className="button button-secondary" onClick={testConnection} disabled={checking}>
            {checking ? <LoaderCircle size={16} className="spin" /> : <Wifi size={16} />}
            测试连接
          </button>
          <button className="button button-primary" onClick={saveAndClose}>保存设置</button>
        </div>
        <p className="modal-footnote">只保存 API 地址与模型名称。API Key 在浏览器刷新、关闭标签页后清除。</p>
      </section>
    </div>
  );
}

function VideoRenderer({ scenes, styleId, title }: { scenes: Scene[]; styleId: StyleId; title: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const previewAbortRef = useRef<AbortController | null>(null);
  const [mode, setMode] = useState<"idle" | "previewing" | "rendering" | "ready" | "error">("idle");
  const [progress, setProgress] = useState(0);
  const [videoUrl, setVideoUrl] = useState("");
  const [renderError, setRenderError] = useState("");

  useEffect(() => () => {
    previewAbortRef.current?.abort();
    if (videoUrl) URL.revokeObjectURL(videoUrl);
  }, [videoUrl]);

  const playSample = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    previewAbortRef.current?.abort();
    const controller = new AbortController();
    previewAbortRef.current = controller;
    setMode("previewing");
    setProgress(0);
    setRenderError("");
    try {
      await previewScenes(canvas, { scenes, styleId, signal: controller.signal, onProgress: setProgress });
      if (!controller.signal.aborted) setMode("idle");
    } catch (error) {
      setRenderError(error instanceof Error ? error.message : "样片预览失败。");
      setMode("error");
    }
  };

  const createVideo = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    previewAbortRef.current?.abort();
    setMode("rendering");
    setProgress(0);
    setRenderError("");
    if (videoUrl) {
      URL.revokeObjectURL(videoUrl);
      setVideoUrl("");
    }
    try {
      const blob = await renderWebM(canvas, { scenes, styleId, onProgress: setProgress });
      const nextUrl = URL.createObjectURL(blob);
      setVideoUrl(nextUrl);
      setMode("ready");
    } catch (error) {
      setRenderError(error instanceof Error ? error.message : "视频生成失败，请重试。");
      setMode("error");
    }
  };

  const downloadVideo = () => {
    if (!videoUrl) return;
    const anchor = document.createElement("a");
    anchor.href = videoUrl;
    anchor.download = `${(title || "vibe-film").replace(/[\\/:*?"<>|\s]+/g, "-").slice(0, 50)}.webm`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  };

  return (
    <div className="render-layout">
      <div className="render-preview-column">
        <div className="preview-frame">
          {videoUrl ? <video className="rendered-video" src={videoUrl} controls playsInline /> : <canvas ref={canvasRef} className="render-canvas" aria-label="Canvas 动画画面预览" />}
          {!videoUrl && mode === "idle" && <div className="preview-prompt"><span className="play-orb"><Play size={20} fill="currentColor" /></span><span>预览画面将在这里播放</span></div>}
          {!videoUrl && mode === "rendering" && <div className="render-progress"><div className="render-progress-head"><span>正在逐帧绘制成片</span><strong>{Math.round(progress * 100)}%</strong></div><div className="progress-track"><i style={{ width: `${Math.round(progress * 100)}%` }} /></div><small>请保持此页面打开，视频仅在本地浏览器合成</small></div>}
        </div>
        <div className="video-preview-meta"><span><Film size={15} /> 竖屏 9:16</span><span><Clock3 size={15} /> 约 {formatDuration(getDuration(scenes))}</span><span>{getStyle(styleId).title}</span></div>
      </div>
      <div className="render-controls">
        <div className="control-card control-card-accent">
          <div className="control-card-icon"><Clapperboard size={20} /></div>
          <div><strong>代码绘制成片</strong><p>把已确认的分镜转为画面与旁白字幕，再录制成 WebM 视频。</p></div>
        </div>
        <div className="render-details">
          <div><span>画布</span><strong>720 × 1280</strong></div>
          <div><span>格式</span><strong>WebM · 24 fps</strong></div>
          <div><span>镜头</span><strong>{scenes.length} 个分镜</strong></div>
          <div><span>渲染位置</span><strong>本地浏览器</strong></div>
        </div>
        {renderError && <div className="inline-error" role="alert">{renderError}</div>}
        <button className="button button-secondary button-wide" onClick={playSample} disabled={mode === "previewing" || mode === "rendering"}>
          {mode === "previewing" ? <LoaderCircle size={17} className="spin" /> : <Play size={17} />}
          {mode === "previewing" ? `样片预览 ${Math.round(progress * 100)}%` : "播放动态样片"}
        </button>
        {videoUrl ? (
          <button className="button button-primary button-wide" onClick={downloadVideo}><Download size={17} /> 下载最终视频</button>
        ) : (
          <button className="button button-primary button-wide" onClick={createVideo} disabled={mode === "rendering" || mode === "previewing"}>
            {mode === "rendering" ? <LoaderCircle size={17} className="spin" /> : <Clapperboard size={17} />}
            {mode === "rendering" ? "正在生成…" : "生成最终视频"}
          </button>
        )}
        {videoUrl && <button className="text-button" onClick={createVideo}><RefreshCw size={14} /> 重新渲染</button>}
        <p className="render-note">导出使用代码动画合成，不会自动调用文生视频服务。当前浏览器生成的文件保存在你本机下载目录。</p>
      </div>
    </div>
  );
}

function StoryboardScene({
  scene,
  index,
  total,
  onChange,
  onMove,
  onRemove,
}: {
  scene: Scene;
  index: number;
  total: number;
  onChange: (value: Scene) => void;
  onMove: (offset: number) => void;
  onRemove: () => void;
}) {
  return (
    <article className="scene-card">
      <div className="scene-number"><span>{String(index + 1).padStart(2, "0")}</span><div className="scene-actions">
        <button className="icon-button small" onClick={() => onMove(-1)} disabled={index === 0} aria-label="上移分镜"><ArrowUp size={14} /></button>
        <button className="icon-button small" onClick={() => onMove(1)} disabled={index === total - 1} aria-label="下移分镜"><ArrowDown size={14} /></button>
        <button className="icon-button small danger" onClick={onRemove} aria-label="删除分镜"><X size={14} /></button>
      </div></div>
      <div className="scene-fields">
        <div className="scene-title-row"><input aria-label="镜头标题" value={scene.title} onChange={event => onChange({ ...scene, title: event.target.value })} /><label><input aria-label="镜头时长秒数" type="number" min={2} max={15} step={0.5} value={scene.duration} onChange={event => onChange({ ...scene, duration: Number(event.target.value) })} /> 秒</label></div>
        <label className="scene-field-label">画面描述<textarea value={scene.visual} maxLength={240} onChange={event => onChange({ ...scene, visual: event.target.value })} rows={2} /></label>
        <label className="scene-field-label">旁白字幕<textarea value={scene.narration} maxLength={260} onChange={event => onChange({ ...scene, narration: event.target.value })} rows={2} /></label>
      </div>
    </article>
  );
}

export default function Home() {
  const [draft, setDraft] = useState<CreatorDraft>(() => loadCreatorDraft());
  const [modelSettings, setModelSettings] = useState<ModelSettings>(() => loadModelSettings());
  const [apiKey, setApiKey] = useState("");
  const [isSettingsOpen, setSettingsOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [connectionLabel, setConnectionLabel] = useState("");
  const ideaRef = useRef<HTMLTextAreaElement>(null);
  const style = getStyle(draft.styleId);

  const setPartialDraft = (patch: Partial<CreatorDraft>) => setDraft(current => ({ ...current, ...patch }));

  useEffect(() => {
    saveCreatorDraft(draft);
  }, [draft]);

  const wordCount = useMemo(() => Array.from(draft.script).filter(character => !/\s/.test(character)).length, [draft.script]);
  const maxStage = draft.scenes.length > 0 && draft.script.trim() ? 4 : 0;
  const status = getStoryStatus(draft.stage, draft.scenes, draft.idea);

  const startProject = () => {
    setError("");
    if (!draft.idea.trim()) {
      ideaRef.current?.focus();
      setError("先写下一个想法，再开始创作。");
      return;
    }
    if (!apiKey.trim() || !modelSettings.model.trim()) {
      setSettingsOpen(true);
      setError("先配置模型地址、模型名称和 API Key，才能生成真实内容。");
      return;
    }
    setBusy(true);
    generateDraft(modelSettings, apiKey, draft.idea.trim())
      .then(generated => {
        setDraft(current => ({ ...current, ...generated, stage: 1 }));
        setConnectionLabel("模型已就绪");
        setError("");
      })
      .catch(reason => setError(reason instanceof Error ? reason.message : "脚本生成失败，请检查模型设置后重试。"))
      .finally(() => setBusy(false));
  };

  const goToStage = (stage: number) => {
    setError("");
    setPartialDraft({ stage });
  };

  const updateScene = (index: number, next: Scene) => {
    setDraft(current => ({ ...current, scenes: current.scenes.map((scene, sceneIndex) => sceneIndex === index ? next : scene) }));
  };

  const moveScene = (index: number, offset: number) => {
    setDraft(current => {
      const target = index + offset;
      if (target < 0 || target >= current.scenes.length) return current;
      const scenes = [...current.scenes];
      [scenes[index], scenes[target]] = [scenes[target], scenes[index]];
      return { ...current, scenes };
    });
  };

  const removeScene = (index: number) => {
    setDraft(current => ({ ...current, scenes: current.scenes.filter((_, sceneIndex) => sceneIndex !== index) }));
  };

  const addScene = () => {
    setDraft(current => ({
      ...current,
      scenes: [...current.scenes, {
        id: `scene-${Date.now()}`,
        title: `新镜头 ${current.scenes.length + 1}`,
        visual: "描述这一镜头的画面",
        narration: "填写与画面对应的旁白字幕",
        duration: 5,
      }],
    }));
  };

  const resetProject = () => {
    setDraft({ idea: "", title: "", summary: "", script: "", scenes: [], styleId: "deep-space", stage: 0 });
    clearCreatorDraft();
    setError("");
  };

  const renderStage = () => {
    if (draft.stage === 0) {
      return (
        <div className="idea-layout">
          <div className="idea-copy">
            <p className="eyebrow">从一个问题，开始一支短片</p>
            <h2>你最近想讲清楚<br /><span>什么知识？</span></h2>
            <p className="intro-copy">写下一个问题、一个概念或一段观察。模型会先把想法整理成可修改的脚本与分镜，再由你决定画面风格和最终成片。</p>
            <div className="idea-chips"><span><Check size={14} />先看脚本，再决定分镜</span><span><Check size={14} />每一步都能调整</span></div>
          </div>
          <div className="idea-input-card">
            <div className="card-kicker"><span className="live-dot" />创作简报 <span className="optional-label">IDEA BRIEF</span></div>
            <label htmlFor="idea-input" className="idea-label">你想做一支关于什么的知识短片？</label>
            <textarea
              ref={ideaRef}
              id="idea-input"
              className="idea-textarea"
              value={draft.idea}
              onChange={event => setPartialDraft({ idea: event.target.value })}
              maxLength={2400}
              placeholder="例如：为什么有些鸟会把闪亮的小物件带回巢里？想用一个生活化的故事，讲清楚动物如何学习和模仿。"
              rows={6}
            />
            <div className="idea-footer"><span>{Array.from(draft.idea).length} / 2400</span><button className="sample-idea" onClick={() => setPartialDraft({ idea: "为什么我们越忙，越容易把重要的事拖到最后？请用一个日常小故事，讲清楚即时奖励如何影响注意力。" })}>试试一条选题 <ArrowRight size={14} /></button></div>
            {error && <div className="inline-error" role="alert">{error}</div>}
            <div className="idea-submit-row"><span className="api-hint"><Sparkles size={15} />生成需要你自己的模型 API</span><button className="button button-primary button-generate" onClick={startProject} disabled={busy}>{busy ? <LoaderCircle size={17} className="spin" /> : <Sparkles size={17} />}{busy ? "模型正在写作…" : "生成脚本与分镜"}<ArrowRight size={16} /></button></div>
          </div>
          <div className="setup-callout"><div className="callout-icon"><Settings2 size={19} /></div><div><strong>{apiKey && modelSettings.model ? "模型配置已填写" : "连接自己的模型 API"}</strong><span>{apiKey && modelSettings.model ? `${modelSettings.model} · API Key 仅保存在当前页面内存` : "支持 OpenAI 兼容接口；填写地址、模型名与 API Key 后即可测试"}</span></div><button className="text-button" onClick={() => setSettingsOpen(true)}>{apiKey && modelSettings.model ? "修改配置" : "配置模型"}<ChevronRight size={15} /></button></div>
        </div>
      );
    }

    if (draft.stage === 1) {
      return (
        <div className="writing-layout">
          <div className="writing-main">
            <div className="section-heading"><div><p className="eyebrow">01 / SCRIPT DRAFT</p><h2>先让故事站稳</h2><p>这是模型基于你的想法写出的初稿。片名和旁白都可以直接修改。</p></div><span className="draft-badge"><Sparkles size={14} />模型生成 · 可编辑</span></div>
            <label className="field-label" htmlFor="story-title">短片标题</label>
            <input id="story-title" className="title-edit-input" value={draft.title} onChange={event => setPartialDraft({ title: event.target.value })} maxLength={80} />
            <div className="summary-strip"><span>一句话</span><p>{draft.summary || "为这支短片写一句简介"}</p></div>
            <label className="field-label script-label" htmlFor="script-text">完整旁白脚本</label>
            <textarea id="script-text" className="script-editor" value={draft.script} onChange={event => setPartialDraft({ script: event.target.value })} maxLength={5000} rows={12} />
            <div className="editor-footer"><span>{wordCount} 字 · 约 {formatDuration(Math.max(0, wordCount / 4.2))} 旁白</span><button className="text-button" onClick={() => navigator.clipboard?.writeText(draft.script).then(() => setConnectionLabel("脚本已复制"))}><FileText size={14} />复制脚本</button></div>
            {error && <div className="inline-error" role="alert">{error}</div>}
            <div className="step-actions"><button className="button button-secondary" onClick={() => goToStage(0)}><ArrowLeft size={16} />返回想法</button><button className="button button-primary" onClick={() => goToStage(2)} disabled={!draft.script.trim() || !draft.title.trim()}>脚本确认，继续分镜<ArrowRight size={16} /></button></div>
          </div>
          <aside className="writing-aside"><div className="aside-icon"><FileText size={20} /></div><strong>好的旁白，不急着塞满信息</strong><p>先读一遍，看看逻辑是否连贯；你也可以删去不想讲的部分。下一步的分镜会使用你确认的脚本内容。</p><div className="aside-divider" /><span className="aside-meta"><Clock3 size={14} />预计时长 · {formatDuration(Math.max(0, wordCount / 4.2))}</span><span className="aside-meta"><Layers3 size={14} />已拆出 {draft.scenes.length} 个镜头提案</span></aside>
        </div>
      );
    }

    if (draft.stage === 2) {
      return (
        <div className="storyboard-stage">
          <div className="section-heading storyboard-heading"><div><p className="eyebrow">02 / STORYBOARD</p><h2>把旁白拆成画面</h2><p>调整画面描述、字幕和镜头顺序；这些信息会直接进入视频渲染。</p></div><div className="storyboard-stats"><span>{draft.scenes.length} 个镜头</span><span>约 {formatDuration(getDuration(draft.scenes))}</span></div></div>
          {draft.scenes.length === 0 ? <div className="empty-state"><Layers3 size={22} /><strong>还没有分镜</strong><span>至少保留 3 个镜头，再进入下一步。</span></div> : <div className="scene-list">{draft.scenes.map((scene, index) => <StoryboardScene key={scene.id} scene={scene} index={index} total={draft.scenes.length} onChange={value => updateScene(index, value)} onMove={offset => moveScene(index, offset)} onRemove={() => removeScene(index)} />)}</div>}
          <button className="add-scene-button" onClick={addScene}><Plus size={16} />添加一个镜头</button>
          {error && <div className="inline-error" role="alert">{error}</div>}
          <div className="step-actions"><button className="button button-secondary" onClick={() => goToStage(1)}><ArrowLeft size={16} />返回脚本</button><button className="button button-primary" onClick={() => { if (draft.scenes.length < 3) { setError("至少保留 3 个镜头，才能进入下一步。"); return; } goToStage(3); }}>分镜确认，挑选风格<ArrowRight size={16} /></button></div>
        </div>
      );
    }

    if (draft.stage === 3) {
      return (
        <div className="style-stage">
          <div className="section-heading"><div><p className="eyebrow">03 / VISUAL DIRECTION</p><h2>给知识一个画面气质</h2><p>选一套色彩和图形语言。它会应用到每个镜头的代码动画与字幕。</p></div><span className="style-count">03 styles / 01 selected</span></div>
          <div className="style-options">{VIDEO_STYLES.map((item, index) => <button key={item.id} className={`style-card ${draft.styleId === item.id ? "selected" : ""} style-card-${item.id}`} onClick={() => setPartialDraft({ styleId: item.id })} aria-pressed={draft.styleId === item.id}>
            <div className="style-art"><span className="art-kicker">FRAME {String(index + 1).padStart(2, "0")}</span><div className={`art-visual art-visual-${item.id}`}><i /><b /><em /></div><span className="art-line" /></div>
            <div className="style-card-info"><div><strong>{item.title}</strong><span>{item.subtitle}</span></div>{draft.styleId === item.id && <span className="selected-check"><Check size={14} /></span>}</div><p>{item.detail}</p>
          </button>)}</div>
          <div className="style-summary"><span className="style-color-dot" style={{ background: style.color }} /><div><strong>当前选择：{style.title}</strong><span>这套风格将贯穿 {draft.scenes.length} 个分镜。</span></div><button className="text-button" onClick={() => goToStage(4)}>预览画布<ArrowRight size={15} /></button></div>
          {error && <div className="inline-error" role="alert">{error}</div>}
          <div className="step-actions"><button className="button button-secondary" onClick={() => goToStage(2)}><ArrowLeft size={16} />返回分镜</button><button className="button button-primary" onClick={() => goToStage(4)}>确认风格，进入成片<ArrowRight size={16} /></button></div>
        </div>
      );
    }

    return (
      <div className="final-stage">
        <div className="section-heading final-heading"><div><p className="eyebrow">04 / FINAL CUT</p><h2>最后一步，生成成片</h2><p>先播放动态样片确认节奏。满意后开始完整录制并下载文件。</p></div><span className="ready-badge"><span className="live-dot" />素材已就绪</span></div>
        {draft.scenes.length < 3 ? <div className="empty-state"><strong>分镜不足</strong><span>请返回分镜步骤，至少保留 3 个镜头。</span><button className="button button-secondary" onClick={() => goToStage(2)}>修改分镜</button></div> : <VideoRenderer key={`${draft.scenes.map(scene => scene.id).join(",")}-${draft.styleId}`} scenes={draft.scenes} styleId={draft.styleId} title={draft.title} />}
        <div className="step-actions final-step-actions"><button className="button button-secondary" onClick={() => goToStage(3)}><ArrowLeft size={16} />返回风格</button><button className="button button-quiet" onClick={resetProject}>新建另一支短片<Plus size={15} /></button></div>
      </div>
    );
  };

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-lockup"><div className="brand-mark"><span /><span /><span /></div><div><strong>VIBE<span>FILM</span></strong><small>知识影像工坊</small></div></div>
        <div className="sidebar-divider" />
        <div className="workspace-label">工作台</div>
        <button className="side-nav-item active"><span className="nav-icon"><Clapperboard size={17} /></span><span>创作一支短片</span><span className="nav-arrow"><ChevronRight size={15} /></span></button>
        <div className="sidebar-divider lower" />
        <div className="sidebar-prompt"><div className="prompt-mark"><Sparkles size={15} /></div><strong>想法先行</strong><p>写下想讲清楚的知识，再逐步变成故事、分镜和画面。</p><div className="prompt-progress"><i /></div><small>一支片子 · 五个步骤</small></div>
        <div className="sidebar-bottom"><div className="sidebar-profile"><div className="profile-avatar">V</div><div><strong>创作者工作台</strong><span>草稿保存在此浏览器</span></div><span className="profile-status" /></div><div className="sidebar-footnote"><LockKeyhole size={12} /> API 密钥只在当前页面会话中使用</div></div>
      </aside>

      <main className="main-area">
        <header className="topbar"><div className="topbar-project"><span className="breadcrumb-muted">工作台</span><ChevronRight size={13} /><span>{draft.title || "新建知识短片"}</span><span className="draft-pill">草稿</span></div><div className="topbar-actions"><div className="model-indicator"><span className={`status-dot ${apiKey && modelSettings.model ? "connected" : ""}`} /><span>{apiKey && modelSettings.model ? connectionLabel || "模型配置已填写" : "未配置模型"}</span></div><button className="button button-topbar" onClick={() => setSettingsOpen(true)}><Settings2 size={16} />模型设置</button><button className="avatar-button" aria-label="Vibe Film">V</button></div></header>

        <div className="workspace-content">
          <div className="page-heading"><div><p className="eyebrow">CREATOR STUDIO <span className="eyebrow-dot">/</span> SHORT-FORM KNOWLEDGE</p><h1>把一个想法，拍成一支片。</h1><p>你的想法、你的脚本、你的镜头。每一步都能亲手决定。</p></div><div className="project-status"><span className="status-chip"><i className={draft.idea.trim() ? "status-dot active" : "status-dot"} />{status}</span><span className="save-state"><Check size={13} />草稿自动保存在本机</span></div></div>

          <nav className="stepper" aria-label="创作步骤">{STEPS.map((step, index) => {
            const Icon = step.icon;
            const completed = step.number < draft.stage;
            const current = step.number === draft.stage;
            const disabled = step.number > maxStage;
            return <div className="stepper-item-wrap" key={step.number}><button className={`stepper-item ${current ? "current" : ""} ${completed ? "completed" : ""} ${disabled ? "disabled" : ""}`} onClick={() => !disabled && goToStage(step.number)} disabled={disabled} aria-current={current ? "step" : undefined}><span className="stepper-icon">{completed ? <Check size={15} /> : <Icon size={15} />}</span><span className="stepper-label">{step.label}</span></button>{index < STEPS.length - 1 && <span className={`stepper-connector ${completed ? "done" : ""}`} />}</div>;
          })}</nav>

          <section className={`workspace-panel stage-${draft.stage}`}>
            {renderStage()}
          </section>
          <footer className="page-footer"><span>VIBE FILM <i>·</i> 从知识到画面，始于一个好问题</span><span>创作内容仅保存在此浏览器 <span className="footer-separator">/</span> 模型密钥不落盘</span></footer>
        </div>
      </main>

      {isSettingsOpen && <ModelSettingsDialog open={isSettingsOpen} onClose={() => setSettingsOpen(false)} settings={modelSettings} setSettings={value => { setModelSettings(value); setConnectionLabel(""); }} apiKey={apiKey} setApiKey={setApiKey} />}
    </div>
  );
}
