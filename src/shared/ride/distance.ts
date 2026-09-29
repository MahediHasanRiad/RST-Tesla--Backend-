const EARTH_RADIUS_KM = 6371;

function toNumber(value: number | string | { toString(): string }) {
  const numeric = Number(value.toString());
  if (!Number.isFinite(numeric)) throw new Error("Invalid coordinate");
  return numeric;
}

export function calculateDistanceKm(
  pickupLatitude: number | string | { toString(): string },
  pickupLongitude: number | string | { toString(): string },
  destinationLatitude: number | string | { toString(): string },
  destinationLongitude: number | string | { toString(): string },
) {
  const latitude1 = (toNumber(pickupLatitude) * Math.PI) / 180;
  const latitude2 = (toNumber(destinationLatitude) * Math.PI) / 180;
  const deltaLatitude = latitude2 - latitude1;
  
  const deltaLongitude =
    ((toNumber(destinationLongitude) - toNumber(pickupLongitude)) * Math.PI) / 180;

  const haversine =
    Math.sin(deltaLatitude / 2) ** 2 +
    Math.cos(latitude1) *
      Math.cos(latitude2) *
      Math.sin(deltaLongitude / 2) ** 2;

  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}
