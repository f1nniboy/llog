import z from "zod"

export interface ClassifyResult {
    /** Whether the message in history is a direct conversational follow-up */
    continuation: boolean
}

export const ClassifySchema = z.object({
    continuation: z.boolean(),
    aboutUser: z.boolean(),
    reason: z.string().describe("In-detail description of your choice"),
})
