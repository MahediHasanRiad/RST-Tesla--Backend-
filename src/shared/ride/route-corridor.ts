export const routeCorridors = [
  ["mirpur-1", "mirpur-2", "mirpur-10"],
  ["uttara-4", "uttara-5", "uttara-6"],
] as const;

export function resolveRouteCorridor(pickupName: string, destinationName: string) {
  const corridor = routeCorridors.find(
    (candidate) =>
      candidate.some((name) => name === pickupName) &&
      candidate.some((name) => name === destinationName),
  );

  if (!corridor) return null;

  const corridorNames: string[] = [...corridor];
  const pickupIndex = corridorNames.indexOf(pickupName);
  const destinationIndex = corridorNames.indexOf(destinationName);
  if (pickupIndex < 0 || destinationIndex < 0 || pickupIndex >= destinationIndex)
    return null;

  return {
    names: corridorNames.slice(pickupIndex, destinationIndex + 1),
    pickupIndex,
    destinationIndex,
  };
}
