import {
    ActivityType,
    Guild,
    PresenceStatus,
    TextBasedChannel,
    User,
} from "discord.js-selfbot-v13"
import { RelationshipTypes } from "discord.js-selfbot-v13/typings/enums.js"
import { AIHistory } from "./history.js"

export type AIObject<T extends { id: string } = { id: string }, U = any> = {
    original: T
    id: string
} & U

export interface AIActivity {
    type: ActivityType
    name: string
    details?: string
    state?: string
}

export interface AIVoiceState {
    channel: string
    muted?: boolean
    deafened?: boolean
}

export type AIUser = AIObject<
    User,
    {
        name: string
        nick?: string
        relationship?: RelationshipTypes
        status: PresenceStatus
        activities?: AIActivity[]
        voice?: AIVoiceState
        self?: boolean
    }
>

export type AIEnvironmentGuild = AIObject<
    Guild,
    {
        name: string
    }
>

export type AIUsableChannel = TextBasedChannel
export type AIEnvironmentChannelType =
    | "text"
    | "voice-text"
    | "stage-text"
    | "thread"

export type AIEnvironmentChannel = AIObject<
    AIUsableChannel,
    {
        type: AIEnvironmentChannelType
        name: string
        id: string
    }
>

export interface AIEnvironment {
    guild?: AIEnvironmentGuild
    channel: AIEnvironmentChannel
    history: AIHistory
    self: AIUser

    /** The current user the AI is chatting with, if applicable */
    user?: AIUser
}
