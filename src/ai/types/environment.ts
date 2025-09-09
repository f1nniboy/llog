import { Guild, PresenceStatus, Snowflake, TextBasedChannel, User } from "discord.js-selfbot-v13";
import { RelationshipTypes } from "discord.js-selfbot-v13/typings/enums.js";

import { AIHistory } from "./history.js";

export type AIObject<T extends { id: Snowflake }, U> = {
    original: T;
} & U

export interface AIActivity {
    name: string;
    details: string | null;
    state: string | null;
}

export interface AIVoiceState {
    channel: string;
    muted: boolean | null;
    deafened: boolean | null;
}

export type AIUser = AIObject<User, {
    /** Name of the user */
    name: string;

    /** Nickname of the user */
    nick?: string;

    /** Type of relationship to the user, by the bot */
    relationship?: RelationshipTypes;

    /** Status of the user */
    status?: PresenceStatus;

    /** Current activity of the user */
    activity?: AIActivity;

    /** Current voice state of the user */
    voice?: AIVoiceState;

    /** ID of the user */
    id: string;

    /** Whether this user is the self-bot */
    self?: boolean;
}>

export type AIEnvironmentGuild = AIObject<Guild, {
    /** Name of the guild */
    name: string;

    /** ID of the guild */
    id: string;

    /** Owner of the guild */
    owner: AIUser;
}>

export type AIChannel = TextBasedChannel
export type AIEnvironmentChannelType = "text" | "voice-text" | "stage-text" | "thread"

export type AIEnvironmentChannel = AIObject<AIChannel, {
    /** Type of the channel */
    type: AIEnvironmentChannelType;

    /** Name of the channel */
    name: string;

    /** ID of the channel */
    id: string;
}>

export interface AIEnvironment {
    /** The current guild */
    guild?: AIEnvironmentGuild;

    /** The current channel */
    channel: AIEnvironmentChannel;

    /** The bot itself */
    self: AIUser;

    /** The current user the AI is chatting with, if applicable */
    user: AIUser | null;

    /** Current chat history */
    history: AIHistory;
}