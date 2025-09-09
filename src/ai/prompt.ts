import assert from "assert";


import { AIProcessOptions, Characters } from "./manager.js";
import { stringToMessageContent } from "../util/chat.js";
import { AIEnvironment } from "./types/environment.js";
import { ChatMessage } from "../api/types/chat.js";
import { AIMemoryEntry } from "./memory.js";
import { Utils } from "../util/utils.js";
import { App } from "../app.js";

/*
HISTORY:
You are given a chat history of previous messages in the chat and when they were sent.
Look at the timestamps to figure out when messages were sent.
You should prioritize responding to recent messages instead of reviving dead threads.
You are not forced to interact with any messages, do as you wish.

TOOLS:
If a tool requests a 'start' parameter, insert a few words of the start of the message to interact with, so it can be identified.
You can call a tool of a single type multiple times, by simply adding it multiple times to the JSON.
Make sure you never run a user's request involving tools double: check if you already acknowledged the request before executing.


*/

export class Prompts {
    public static baseInstructions(
        app: App,
        env: AIEnvironment
    ) {
        const {
            prompts: {
                tone, persona, interests, dislikes
            },
            nickname
        } = app.config.data;

        return `
You're a real Discord user named ${env.self.name}, never break character. 
Tone: ${tone || ""}.
Persona: ${persona || ""}. 
Interests: ${interests.join(", ")}.
Dislikes: ${dislikes.join(", ")}. 
In ${env.guild ? `${env.guild.name} #${env.channel.name} ${env.channel.type}` : `PM with ${env.channel.name}`}. 
Nickname(s): ${nickname ? (typeof nickname === "string" ? nickname : nickname.join(", ")) : ""}. 
Date: ${Utils.formatDate(new Date())}.

Insert "${Characters.Splitting}" to split messages. Reply only to the last message. If none, use "${Characters.Ignore}". 
Format: "{author} ({nick}) ([reply to...:'...'])${Characters.Separator}{content}".

You must save important/new information you revealed about yourself or were told by users using saveMemory tool.
Use properly and use often. Only save information learned from recent message in history.

Continue.
`;
    }

    public static async chat(
        app: App,
        _options: AIProcessOptions,
        environment: AIEnvironment,
        memories: AIMemoryEntry[]
    ): Promise<ChatMessage[]> {
        const m: ChatMessage[] = [];
        const features = app.config.data.features;

        if (features.users) m.push({
            role: "system", content: stringToMessageContent(`Users currently in chat:\n${environment.history.users.map(user => `${user.name} =\n${app.ai.env.stringify(user, [ "name", "self", "bio" ])}`).join("\n")}`)
        });

        m.push({
            role: "system", content: stringToMessageContent(Prompts.baseInstructions(app, environment))
        });

        if (memories.length > 0) m.push({
            role: "system", content: stringToMessageContent(`Your previous memories which may be fitting, use if applicable:\n${memories.map(m => app.ai.memory.toMemoryPromptString(m)).join("\n")}`)
        });

        for (const message of environment.history.messages) {
            m.push(await app.ai.toAPIMessage(environment, message));
        }

        return m;
    }

    public static async work(
        app: App,
        options: AIProcessOptions,
        environment: AIEnvironment,
        _memories: AIMemoryEntry[]
    ): Promise<ChatMessage[]> {
        assert(options.task);
        assert(options.task.context.instructions);

        const m: ChatMessage[] = [];

        m.push({
            role: "system", content: stringToMessageContent(`
${Prompts.baseInstructions(app, environment)}

YOUR TASK:
Your task is to fulfill the following task, which you wrote to your memory to remember, added at ${Utils.formatDate(new Date(options.task.time))}:
""${options.task.context.instructions}""
Fulfill it using tools.`)
        });

        return m;
    }
}