export function formatVideoScriptSceneLabel(index: number) {
  return `SCENE ${String(index).padStart(2, "0")}`;
}

export function getVideoScriptOverviewSummary(
  sceneCount: number,
  duration: string,
) {
  return `${sceneCount} 个镜头 · ${duration}`;
}
