export const COUNTER_FARE_TTL_SECONDS = 24 * 60 * 60;

export function counterFareRedisKey(rideRequestId: string) {
  return `ride-request:counter-fare:${rideRequestId}`;
}
