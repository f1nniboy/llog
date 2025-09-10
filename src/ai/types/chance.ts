export const ChanceTypes = [ "typo", "reply" ] as const;
export type ChanceType = typeof ChanceTypes[number];