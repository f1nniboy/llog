import { DMChannel, GuildTextBasedChannel, Message, Snowflake, ThreadChannel } from "discord.js-selfbot-v13";
import { AIChannel, AIUser } from "./environment.js";

export interface AIHistoryOptions {
    /** How many messages of history to fetch */
    count: number;

    /** Which channel to fetch them from */
    channel: AIChannel;

    /** Which message ID should be put at the last position */
    message?: Message;
}

export interface AIMessageTag {
    name: string;
    content: string[] | string;
}

export interface AIMessageAttachment {
    url: string;
}

export interface AIMessage {
    /** ID of the message */
    id: Snowflake;

    /** Author of the message */
    author: AIUser;

    /** When the message was posted, as an ISO date string */
    when: string;

    /** Content of the message */
    content: string;

    /** Attachments of the message */
    attachments: AIMessageAttachment[];

    /** Additional tags for the message */
    tags: AIMessageTag[];

    /** Which message this one is replying to */
    replyTo?: AIMessage;

    /** Whether the message was sent by the bot */
    self?: boolean;

    /** Whether the message mentioned the bot */
    mentioned?: boolean;
}

export interface AIHistory {
    /** Users in the chat history */
    users: AIUser[];

    /** Messages in the chat history */
    messages: AIMessage[];
}