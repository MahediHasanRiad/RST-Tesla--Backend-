export const BASE_FARE_PAISA = 5_000;
export const PER_KILOMETER_RATE_PAISA = 1_000;

export const weatherAdjustmentRates = {
  CLEAR: 0,
  RAIN: 0.1,
  HEAVY_RAIN: 0.2,
} as const;

export type WeatherCondition = keyof typeof weatherAdjustmentRates;

export function calculateFare(
  distanceKm: number,
  weatherCondition: WeatherCondition = "CLEAR",
) {
  const distanceCharge = Math.round(distanceKm * PER_KILOMETER_RATE_PAISA);
  const subtotal = BASE_FARE_PAISA + distanceCharge;
  const weatherAdjustment = Math.round(
    subtotal * weatherAdjustmentRates[weatherCondition],
  );

  return {
    baseFare: BASE_FARE_PAISA,
    distanceKm: Number(distanceKm.toFixed(2)),
    perKmRate: PER_KILOMETER_RATE_PAISA,
    distanceCharge,
    weatherCondition,
    weatherAdjustment,
    estimatedFare: subtotal + weatherAdjustment,
    currency: "BDT" as const,
    unit: "POISHA" as const,
  };
}
