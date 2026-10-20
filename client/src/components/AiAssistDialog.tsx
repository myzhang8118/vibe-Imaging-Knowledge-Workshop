import type { ReactNode } from "react";
import { Check, LoaderCircle, Sparkles, X } from "lucide-react";
import { VIDEO_STYLES, type AiAssistSuggestion, type CreatorDraft, type Scene, type StyleId } from "@/lib/creator";

type AiAssistDialogProps = {
  open: boolean;
  title: string;
  description: string;
  instruction: string;
  onInstructionChange: (value: string) => void;
  busy: boolean;
  error: string;
  hasSuggestion: boolean;
  onGenerate: () => void;
  onApply: () => void;
  onClose: () => void;
  children?: ReactNode;
};

function ComparePane({ label, value }: { label: string; value: string }) {
  return (
    <article className="assist-compare-pane">
      <span>{label}</span>
      <pre>{value.trim() || "（暂无内容）"}</pre>
    </article>
  );
}

function sceneText(scene?: Scene) {
  if (!scene) return "（无对应原镜头）";
  return `镜头：${scene.title}\n时长：${scene.duration} 秒\n画面：${scene.visual}\n旁白：${scene.narration}`;
}

function SceneComparisons({ before, after }: { before: Scene[]; after: Scene[] }) {
  const afterIds = new Set(after.map(scene => scene.id));
  const removed = before.filter(scene => !afterIds.has(scene.id));
  return (
    <div className="assist-scene-comparisons">
      {after.map((scene, index) => {
        const original = before.find(item => item.id === scene.id) ?? before[index];
        return (
          <div className="assist-scene-compare" key={`${scene.id}-${index}`}>
            <strong>镜头 {String(index + 1).padStart(2, "0")}</strong>
            <div className="assist-compare-grid">
              <ComparePane label="当前分镜" value={sceneText(original)} />
              <ComparePane label="AI 候选" value={sceneText(scene)} />
            </div>
          </div>
        );
      })}
      {removed.map(scene => {
        const originalIndex = before.findIndex(item => item.id === scene.id) + 1;
        return (
          <div className="assist-scene-compare assist-scene-removed" key={`removed-${scene.id}`}>
            <strong>AI 候选将移除镜头 {String(originalIndex).padStart(2, "0")}</strong>
            <div className="assist-compare-grid"><ComparePane label="将被移除的当前分镜" value={sceneText(scene)} /><ComparePane label="AI 候选" value="删除此镜头" /></div>
          </div>
        );
      })}
    </div>
  );
}

function styleLabel(styleId: StyleId) {
  const style = VIDEO_STYLES.find(item => item.id === styleId) ?? VIDEO_STYLES[0];
  return `${style.title} · ${style.subtitle}\n${style.detail}`;
}

export function AiAssistPreview({ suggestion, previous }: { suggestion: AiAssistSuggestion; previous: CreatorDraft }) {
  let content: ReactNode;

  switch (suggestion.stage) {
    case "idea":
      content = <div className="assist-compare-grid"><ComparePane label="当前想法" value={previous.idea} /><ComparePane label="AI 候选想法" value={suggestion.idea} /></div>;
      break;
    case "script":
      content = (
        <>
          <div className="assist-compare-grid">
            <ComparePane label="当前标题 / 简介" value={`${previous.title}\n${previous.summary}`} />
            <ComparePane label="候选标题 / 简介" value={`${suggestion.title}\n${suggestion.summary}`} />
          </div>
          <div className="assist-compare-grid">
            <ComparePane label="当前旁白脚本" value={previous.script} />
            <ComparePane label="AI 候选脚本" value={suggestion.script} />
          </div>
        </>
      );
      break;
    case "scene": {
      const original = previous.scenes.find(item => item.id === suggestion.scene.id);
      content = <div className="assist-compare-grid"><ComparePane label="当前分镜" value={sceneText(original)} /><ComparePane label="AI 候选分镜" value={sceneText(suggestion.scene)} /></div>;
      break;
    }
    case "storyboard":
      content = <SceneComparisons before={previous.scenes} after={suggestion.scenes} />;
      break;
    case "style":
      content = <div className="assist-compare-grid"><ComparePane label="当前风格" value={styleLabel(previous.styleId)} /><ComparePane label="AI 推荐风格" value={styleLabel(suggestion.styleId)} /></div>;
      break;
    case "final":
      content = (
        <>
          <div className="assist-compare-grid">
            <ComparePane label="当前标题 / 简介" value={`${previous.title}\n${previous.summary}`} />
            <ComparePane label="候选标题 / 简介" value={`${suggestion.title}\n${suggestion.summary}`} />
          </div>
          <div className="assist-compare-grid">
            <ComparePane label="当前旁白脚本" value={previous.script} />
            <ComparePane label="AI 候选脚本" value={suggestion.script} />
          </div>
          <div className="assist-style-row"><ComparePane label="当前风格" value={styleLabel(previous.styleId)} /><ComparePane label="候选风格" value={styleLabel(suggestion.styleId)} /></div>
          <SceneComparisons before={previous.scenes} after={suggestion.scenes} />
        </>
      );
      break;
  }

  return (
    <section className="assist-preview" aria-label="AI 候选内容预览">
      <div className="assist-preview-heading"><div><Sparkles size={15} /><strong>候选修改 · 尚未应用</strong></div><p>{suggestion.explanation}</p></div>
      <div className="assist-preview-body">{content}</div>
    </section>
  );
}

export function AiAssistDialog({
  open,
  title,
  description,
  instruction,
  onInstructionChange,
  busy,
  error,
  hasSuggestion,
  onGenerate,
  onApply,
  onClose,
  children,
}: AiAssistDialogProps) {
  if (!open) return null;

  const close = () => { if (!busy) onClose(); };

  return (
    <div className="modal-scrim assist-scrim" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) close(); }}>
      <section className="settings-modal ai-assist-modal" role="dialog" aria-modal="true" aria-labelledby="ai-assist-title">
        <div className="modal-topline">
          <div className="modal-symbol"><Sparkles size={19} /></div>
          <button className="icon-button modal-close" onClick={close} disabled={busy} aria-label="关闭 AI 修改"><X size={18} /></button>
        </div>
        <p className="eyebrow">VIBE EDITOR · AI ASSIST</p>
        <h2 id="ai-assist-title">{title}</h2>
        <p className="modal-description">{description}</p>
        <label className="field-label assist-prompt-label" htmlFor="ai-assist-prompt">告诉 AI 你想怎么改</label>
        <textarea
          id="ai-assist-prompt"
          className="assist-prompt"
          value={instruction}
          onChange={event => onInstructionChange(event.target.value)}
          maxLength={1200}
          rows={4}
          disabled={busy}
        />
        <div className="assist-usage-note"><span>会使用当前已配置模型，可能产生模型费用；候选不会自动覆盖原稿。</span><span>{instruction.length} / 1200</span></div>
        {error && <div className="inline-error" role="alert">{error}</div>}
        {busy && <div className="assist-loading" role="status"><LoaderCircle size={16} className="spin" />正在生成可预览的修改建议，最长约两分钟…</div>}
        {hasSuggestion && children}
        <div className="modal-actions assist-modal-actions">
          <button className="button button-quiet" onClick={close} disabled={busy}>放弃</button>
          <button className="button button-secondary" onClick={onGenerate} disabled={busy || !instruction.trim()}>
            {busy ? <LoaderCircle size={16} className="spin" /> : <Sparkles size={16} />}
            {hasSuggestion ? "重新生成建议" : "生成修改建议"}
          </button>
          {hasSuggestion && <button className="button button-primary" onClick={onApply} disabled={busy}><Check size={16} />应用这版</button>}
        </div>
      </section>
    </div>
  );
}
