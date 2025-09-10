export const ChanceTypes = [ "trigger", "typo", "reply" ] as const;
export type ChanceType = typeof ChanceTypes[number];