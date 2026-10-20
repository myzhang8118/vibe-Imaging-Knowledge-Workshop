import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, LoaderCircle, Play, Sparkles } from "lucide-react";
import { previewScenes, drawSceneFrame } from "@/lib/videoRenderer";
import type { Scene, StyleId } from "@/lib/creator";
import { SceneFrameCanvas } from "@/components/SceneFrameCanvas";

export function VisualPreviewStage({
  scenes,
  styleId,
  onAiImprove,
  onBack,
  onContinue,
  error,
}: {
  scenes: Scene[];
  styleId: StyleId;
  onAiImprove: (sceneId: string) => void;
  onBack: () => void;
  onContinue: () => void;
  error: string;
}) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const controllerRef = useRef<AbortController | null>(null);
  const selected = scenes[Math.min(selectedIndex, scenes.length - 1)];

  useEffect(() => {
    setSelectedIndex(index => Math.max(0, Math.min(index, scenes.length - 1)));
  }, [scenes.length]);

  useEffect(() => {
    if (playing || !selected) return;
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    canvas.width = 720;
    canvas.height = 1280;
    drawSceneFrame(context, selected, selectedIndex, scenes.length, styleId, 0.28);
  }, [playing, scenes, selected, selectedIndex, styleId]);

  useEffect(() => () => controllerRef.current?.abort(), []);

  const playAll = async () => {
    const canvas = canvasRef.current;
    if (!canvas || !scenes.length) return;
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setPlaying(true);
    setProgress(0);
    try {
      await previewScenes(canvas, { scenes, styleId, signal: controller.signal, onProgress: setProgress });
    } finally {
      if (!controller.signal.aborted) setPlaying(false);
    }
  };

  const selectScene = (index: number) => {
    controllerRef.current?.abort();
    setPlaying(false);
    setSelectedIndex(index);
  };

  if (!scenes.length || !selected) {
    return <div className="empty-state"><strong>还没有可以预览的镜头</strong><span>返回分镜步骤，先确认至少一个镜头。</span></div>;
  }

  return (
    <div className="visual-preview-stage">
      <div className="section-heading visual-preview-heading">
        <div><p className="eyebrow">03 / FRAME PREVIEW</p><h2>先看画面，再决定怎么改</h2><p>这一步展示正片将实际绘制的图形与旁白字幕。画面描述只作编辑参考，不会显示到正片。</p></div>
        <button className="button button-secondary" onClick={playAll} disabled={playing}>
          {playing ? <LoaderCircle size={15} className="spin" /> : <Play size={15} />}
          {playing ? `播放中 ${Math.round(progress * 100)}%` : "播放整段样片"}
        </button>
      </div>
      {error && <div className="inline-error" role="alert">{error}</div>}

      <div className="visual-preview-layout">
        <div className="visual-preview-main">
          <div className="visual-stage-canvas-wrap">
            <canvas ref={canvasRef} className="visual-stage-canvas" width={720} height={1280} aria-label={`第 ${selectedIndex + 1} 镜正片画面预览`} />
            {playing && <div className="visual-play-progress"><i style={{ width: `${Math.round(progress * 100)}%` }} /></div>}
          </div>
          <div className="visual-preview-controls">
            <button className="icon-button" onClick={() => selectScene(Math.max(0, selectedIndex - 1))} disabled={selectedIndex === 0 || playing} aria-label="上一个镜头"><ArrowLeft size={17} /></button>
            <span>镜头 {String(selectedIndex + 1).padStart(2, "0")} <i>/</i> {String(scenes.length).padStart(2, "0")}</span>
            <button className="icon-button" onClick={() => selectScene(Math.min(scenes.length - 1, selectedIndex + 1))} disabled={selectedIndex === scenes.length - 1 || playing} aria-label="下一个镜头"><ArrowRight size={17} /></button>
          </div>
        </div>

        <aside className="visual-inspector">
          <div className="visual-inspector-top"><span>当前镜头</span><strong>{String(selectedIndex + 1).padStart(2, "0")} / {String(scenes.length).padStart(2, "0")}</strong></div>
          <h3>{selected.title || `镜头 ${selectedIndex + 1}`}</h3>
          <div className="visual-inspector-field"><span>画面修改参考 · 不会进入正片</span><p>{selected.visual || "暂无画面描述"}</p></div>
          <div className="visual-inspector-field narration-field"><span>将作为字幕呈现的旁白</span><p>{selected.narration || "暂无旁白字幕"}</p></div>
          <button className="button button-primary visual-ai-button" onClick={() => onAiImprove(selected.id)}><Sparkles size={16} />告诉 AI 怎么改这个画面</button>
          <p className="visual-inspector-note">例如：“把中心圆形移到右侧，删掉两条轨道线，补一组由低到高的暖色柱形。”AI 会直接调整这镜的画面元素，修改前后供你对照。</p>
        </aside>
      </div>

      <div className="visual-filmstrip" aria-label="选择要预览的镜头">
        {scenes.map((scene, index) => (
          <button key={scene.id} className={`visual-filmstrip-item ${index === selectedIndex ? "selected" : ""}`} onClick={() => selectScene(index)} disabled={playing} aria-pressed={index === selectedIndex}>
            <SceneFrameCanvas scene={scene} index={index} total={scenes.length} styleId={styleId} className="visual-filmstrip-thumb" progress={0.28} />
            <span><i>{String(index + 1).padStart(2, "0")}</i>{scene.title || `镜头 ${index + 1}`}</span>
          </button>
        ))}
      </div>

      <div className="step-actions"><button className="button button-secondary" onClick={onBack}><ArrowLeft size={16} />返回分镜</button><button className="button button-primary" onClick={onContinue}>画面确认，挑选风格<ArrowRight size={16} /></button></div>
    </div>
  );
}
