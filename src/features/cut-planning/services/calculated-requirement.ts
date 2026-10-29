/**
 * Fabric required for a marker lay, in linear metres.
 *
 * The physical marker length is supplied by CAD/marker making. The system
 * multiplies that length by the number of plies; width is not part of a
 * linear-metre requirement.
 */
export function calculateRequiredFabricMetres(
  markerLengthM: number | null,
  markerPlies: number,
): number | null {
  if (markerLengthM == null || !Number.isFinite(markerLengthM)) return null;

  const plies = Number.isFinite(markerPlies) ? markerPlies : 0;
  return Math.round(markerLengthM * plies * 1000) / 1000;
}
