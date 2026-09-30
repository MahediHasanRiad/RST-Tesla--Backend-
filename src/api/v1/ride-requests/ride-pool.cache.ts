export const AVAILABLE_RIDE_POOL_CACHE_TTL_SECONDS = 60;
export const AVAILABLE_RIDE_POOL_VERSION_TTL_SECONDS =
  AVAILABLE_RIDE_POOL_CACHE_TTL_SECONDS * 2;

export function availableRidePoolVersionKey(
  pickupZoneId: string,
  destinationZoneId: string,
) {
  return `ride-pools:available:v1:version:${pickupZoneId}:${destinationZoneId}`;
}

export function availableRidePoolCacheKey(input: {
  version: string;
  pickupZoneId: string;
  destinationZoneId: string;
  seats: number;
  cursor?: string;
  limit: number;
}) {
  return [
    "ride-pools:available:v1",
    `version=${encodeURIComponent(input.version)}`,
    `pickup=${encodeURIComponent(input.pickupZoneId)}`,
    `destination=${encodeURIComponent(input.destinationZoneId)}`,
    `seats=${input.seats}`,
    `cursor=${encodeURIComponent(input.cursor ?? "")}`,
    `limit=${input.limit}`,
  ].join(":");
}
