import { createTwoFilesPatch } from "diff";

export function unifiedDiff(beforeText: string, afterText: string): string {
  return createTwoFilesPatch(
    "config.yaml",
    "config.yaml",
    beforeText,
    afterText,
    "on-disk",
    "would-be",
    { context: 3 },
  );
}
