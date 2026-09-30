import { availableParallelism } from "node:os";

export function getClusterWorkerCount(
  configuredWorkers?: number,
  cpuCount = availableParallelism(),
) {
  return Math.max(1, configuredWorkers ?? cpuCount - 1);
}
