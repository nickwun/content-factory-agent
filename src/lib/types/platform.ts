export const PLATFORM_TYPES = [
  "wechat_article",
  "xiaohongshu",
  "twitter",
  "video_script",
] as const;

export type PlatformType = (typeof PLATFORM_TYPES)[number];

export type EditorSaveState =
  | "idle"
  | "dirty"
  | "saving"
  | "saved"
  | "error";

export function isPlatformType(value: string): value is PlatformType {
  return PLATFORM_TYPES.includes(value as PlatformType);
}
