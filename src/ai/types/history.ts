import { DMChannel, GuildTextBasedChannel, Message, Snowflake, ThreadChannel } from "discord.js-selfbot-v13";
import { AIUser } from "./environment.js";

export interface AIHistoryOptions {
    /** How many messages of history to fetch */
    count: number;

    /** Which channel to fetch them from */
    channel: DMChannel | GuildTextBasedChannel | ThreadChannel;

    /** Which message ID should be put at the last position */
    message?: Message;
}

export interface AIMessageTag {
    name: string;
    content: string[] | string;
}

export interface AIMessage {
    /** ID of the message */
    id: Snowflake;

    /** Author of the message */
    author: AIUser;

    /** When the message was posted, as an ISO date string */
    when: string;

    /** Content of the message, if applicable */
    content: string;

    /** Additional tags for the message */
    tags: AIMessageTag[];

    /** Which message this one is replying to */
    replyTo?: AIMessage;

    /** Whether this message mentioned the bot */
    mentioned?: boolean;
}

export interface AIHistory {
    /** Users in the chat history */
    users: AIUser[];

    /** Messages in the chat history */
    messages: AIMessage[];
}