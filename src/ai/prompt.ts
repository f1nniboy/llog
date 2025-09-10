import assert from "assert";

import { AIProcessOptions, Characters } from "./manager.js";
import { stringToMessageContent } from "../util/chat.js";
import { ChatInputMessage } from "../api/types/chat.js";
import { AIEnvironment } from "./types/environment.js";
import { AIMemoryEntry } from "./memory.js";
import { Utils } from "../util/utils.js";
import { App } from "../app.js";

type InstructionType = "static" | "dynamic" | "memories" | "users" | "task"

interface InstructionOptions {
    app: App;
    env: AIEnvironment;
    memories: AIMemoryEntry[];
    request: AIProcessOptions;
    cache?: boolean;
}

const Instructions: Record<InstructionType, (options: InstructionOptions) => (string | undefined)[] | string | undefined> = {
    static: ({ app, env }) => [
        `act as real human Discord user named ${env.self.name}`,
        "never break character",
        app.config.data.personality.tone,
        app.config.data.personality.persona,
        "make up information about self if needed",
        "must remember new important information and detailed descriptions",
        `can insert ${Characters.Splitting} to split message, do not overuse`,
        "only reply last message"
    ],
    dynamic: ({ env }) => [
        `in ${env.guild ? `server ${env.guild.name}, channel #${env.channel.name}` : `DM with ${env.channel.name}`}`,
        `date: ${Utils.formatDate()}`
    ],
    memories: ({ app, memories }) => `previous memories, use if applicable:\n${
        memories.map(m => app.ai.memory.toMemoryPromptString(m)).join("\n")
    }`,
    users: ({ app, env }) => `users currently in chat:\n${
        env.history.users.map(
            user => `${user.name} =\n${app.ai.env.stringify(user, [ "name", "self", "bio" ])}`
        ).join("\n")
    }`,
    task: ({ request }) =>
        request.task ? [
            "Fulfill following task using tools, added at ${Utils.formatDate(new Date(request.task.time))}",
            "Do not write a reply unless asked",
            request.task.context.instructions
        ] : undefined
};

export class Prompts {
    public static instructions(
        type: InstructionType,
        options: InstructionOptions
    ): ChatInputMessage[] {
        const raw = Instructions[type](options);

        const result: string[] = Array.isArray(raw)
            ? raw.filter(i => i && i.length > 0) as string[]
            : raw ? [ raw ] : [];
                
        return [ {
            role: "system",
            content: stringToMessageContent(result.join("\n"))
        } ];
    }

    public static async chat(
        app: App,
        options: AIProcessOptions,
        env: AIEnvironment,
        memories: AIMemoryEntry[]
    ): Promise<ChatInputMessage[]> {
        const m: ChatInputMessage[] = [];
        const features = app.config.data.features;

        const o: InstructionOptions = {
            app, request: options, env, memories
        };

        m.push(
            ...Prompts.instructions("static", {  ...o, cache: true }),
            ...Prompts.instructions("dynamic", o)
        );

        if (memories.length > 0) m.push(
            ...Prompts.instructions("memories", o)
        );

        if (features.users) m.push(
            ...Prompts.instructions("users", o) 
        );

        for (const message of env.history.messages) {
            m.push(await app.ai.toAPIMessage(env, message));
        }

        return m;
    }

    public static async work(
        app: App,
        options: AIProcessOptions,
        env: AIEnvironment,
        memories: AIMemoryEntry[]
    ): Promise<ChatInputMessage[]> {
        assert(options.task);
        assert(options.task.context.instructions);

        const m: ChatInputMessage[] = [];

        const o: InstructionOptions = {
            app, request: options, env, memories
        };

        m.push(
            ...Prompts.instructions("static", {  ...o, cache: true }),
            ...Prompts.instructions("dynamic", o),
            ...Prompts.instructions("task", o)
        );

        return m;
    }
}