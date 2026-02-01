import { Message, Snowflake } from "discord.js-selfbot-v13"
import { AIUsableChannel, AIUser } from "./environment.js"

export interface AIHistoryOptions {
    /** Which channel to fetch them from */
    channel: AIUsableChannel

    /** Which messages should be put at the last position */
    triggers?: Message[]
}

export interface AIMessageTag {
    name: string
    content: string[] | string
}

export interface AIMessage {
    /** ID of the message */
    id: Snowflake

    /** Author of the message */
    author: AIUser

    /** When the message was posted, as an ISO date string */
    when: string

    /** Content of the message */
    content: string

    /** Additional tags for the message */
    tags: AIMessageTag[]

    /** Which message this one is replying to */
    replyTo?: AIMessage

    /** Whether the message was sent by the bot */
    self?: boolean

    /** Whether the message mentioned the bot */
    mentioned?: boolean
}

export interface AIHistory {
    /** Users in the chat history */
    users: AIUser[]

    /** Messages in the chat history */
    messages: AIMessage[]
}
