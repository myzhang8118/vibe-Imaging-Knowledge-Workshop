import { afterEach, describe, expect, it, vi } from "vitest";
import { loadCreatorDraft, type Scene } from "../client/src/lib/creator";
import { drawSceneFrame } from "../client/src/lib/videoRenderer";

afterEach(() => vi.unstubAllGlobals());

describe("画面预览与旧草稿兼容", () => {
  it("正片 Canvas 绘制旁白和图形元素，但绝不绘制标题或 visual 画面说明", () => {
    const visibleText: string[] = [];
    let ellipseCount = 0;
    const context = new Proxy({
      createLinearGradient: () => ({ addColorStop: () => undefined }),
      measureText: (value: string) => ({ width: value.length * 8 }),
      fillText: (value: string) => visibleText.push(value),
      ellipse: () => { ellipseCount += 1; },
    }, {
      get(target, key) {
        if (key in target) return target[key as keyof typeof target];
        return () => undefined;
      },
      set(target, key, value) {
        Reflect.set(target, key, value);
        return true;
      },
    }) as unknown as CanvasRenderingContext2D;

    const scene: Scene = {
      id: "scene-1",
      title: "不应出现在正片的镜头标题",
      visual: "不应出现在正片的画面描述",
      visualElements: [
        { id: "shape-1", type: "circle", x: 0.5, y: 0.4, width: 0.2, height: 0.18, rotation: 0, color: "accent" },
        { id: "copied-title", type: "text", text: "不应出现在正片的镜头标题", x: 0.5, y: 0.35, width: 0.3, height: 0.05, rotation: 0, color: "light" },
        { id: "copied-description", type: "text", text: "不应出现在正片的画面描述", x: 0.5, y: 0.47, width: 0.3, height: 0.05, rotation: 0, color: "light" },
      ],
      narration: "这句旁白字幕应出现在画面中。",
      duration: 5,
    };

    drawSceneFrame(context, scene, 0, 1, "deep-space", 0.3);

    expect(visibleText.join(" ")).toContain(scene.narration);
    expect(visibleText.join(" ")).not.toContain(scene.visual);
    expect(visibleText.join(" ")).not.toContain(scene.title);
    expect(ellipseCount).toBeGreaterThan(0);
  });

  it("兼容旧版本地草稿：为历史镜头补默认图形并迁移旧成片阶段", () => {
    const oldDraft = {
      idea: "旧选题",
      title: "旧短片",
      summary: "简介",
      script: "旁白脚本",
      scenes: [{ id: "old-scene", title: "镜头", visual: "增长曲线", narration: "旁白", duration: 5 }],
      styleId: "archive",
      stage: 4,
    };
    const values = new Map([["vibefilm.creatorDraft.v1", JSON.stringify(oldDraft)]]);
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key),
    });

    const migrated = loadCreatorDraft();

    expect(migrated.stage).toBe(5);
    expect(migrated.scenes[0].visualElements.length).toBeGreaterThan(0);
    expect(migrated.styleId).toBe("archive");
  });
});
