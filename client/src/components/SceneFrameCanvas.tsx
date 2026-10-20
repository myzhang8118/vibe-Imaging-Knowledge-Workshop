import { useEffect, useRef } from "react";
import { drawSceneFrame } from "@/lib/videoRenderer";
import type { Scene, StyleId } from "@/lib/creator";

export function SceneFrameCanvas({
  scene,
  index,
  total,
  styleId,
  className,
  progress = 0.28,
}: {
  scene: Scene;
  index: number;
  total: number;
  styleId: StyleId;
  className?: string;
  progress?: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    canvas.width = 720;
    canvas.height = 1280;
    drawSceneFrame(context, scene, index, total, styleId, progress);
  }, [index, progress, scene, styleId, total]);

  return <canvas ref={canvasRef} className={className} width={720} height={1280} aria-label={`第 ${index + 1} 镜实际画面预览`} />;
}
