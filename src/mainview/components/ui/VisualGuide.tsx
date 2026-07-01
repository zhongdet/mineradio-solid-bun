// @ts-nocheck
import { Component } from "solid-js";
import { useUi } from "../../stores/uiStore";
import { activeVisualGuideSteps, nextVisualGuideStep, closeVisualGuide } from "../../lib/startupGuides";

const VisualGuide: Component = () => {
  const ui = useUi();

  const steps = () => activeVisualGuideSteps();
  const currentStep = () => steps()[ui.state.visualGuideStep] || steps()[0];
  const stepIndex = () => ui.state.visualGuideStep;
  const totalSteps = () => steps().length;
  const isLastStep = () => stepIndex() >= totalSteps() - 1;

  const kicker = () => currentStep().kicker;
  const title = () => currentStep().title;
  const body = () => currentStep().body;
  const hint = () => isLastStep() ? "点击空白处完成引导" : "点击空白处也可以继续";
  const progress = () => `${stepIndex() + 1} / ${totalSteps()}`;
  const nextLabel = () => isLastStep() ? "完成" : "下一步";

  return (
    <div
      id="visual-guide"
      aria-live="polite"
      aria-hidden="true"
    >
      <div class="visual-guide-scrim"></div>
      <div id="visual-guide-ring" class="visual-guide-ring"></div>
      <div id="visual-guide-card" class="visual-guide-card">
        <div class="visual-guide-kicker">{kicker()}</div>
        <div class="visual-guide-title">{title()}</div>
        <div class="visual-guide-body">{body()}</div>
        <div class="visual-guide-hint">{hint()}</div>
        <div class="visual-guide-actions">
          <button type="button" onClick={(e) => { e.stopPropagation(); closeVisualGuide(true); }}>跳过</button>
          <div class="visual-guide-progress">{progress()}</div>
          <button class="primary" type="button" onClick={(e) => { e.stopPropagation(); nextVisualGuideStep(); }}>{nextLabel()}</button>
        </div>
      </div>
    </div>
  );
};

export default VisualGuide;
