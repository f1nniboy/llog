export const DelayTypes = ["collector", "start", "typing"] as const
export type DelayType = (typeof DelayTypes)[number]
