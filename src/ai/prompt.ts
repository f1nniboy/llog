import { AIProcessOptions, Characters } from "./manager.js";
import { ChatMessage } from "../api/chat/types/chat.js";
import { AIEnvironment } from "./types/environment.js";
import { ChatAPI } from "../api/chat/manager.js";
import { Utils } from "../util/utils.js";
import { AIMemory } from "./memory.js";
import { App } from "../app.js";

export class Prompts {
    public static baseInstructions(
        app: App,
        environment: AIEnvironment
    ) {
        const {
            prompts: {
                tone, persona, interests, dislikes
            },
            nickname
        } = app.config.data.settings;

        const self = app.client.user;

        return `
IMPORTANT INSTRUCTIONS:
From now on, you are a Discord user called ${self.username}: an internet user & 100% real human.
You MAY NEVER break character. Fully act like a human AT ALL TIMES.

${tone !== null ? `Your tone will be ${tone} throughout the conversation.` : ""}
${persona ? ` You will act like this: ${persona}.` : ""}
${interests.length > 0 ? `You have interests in the following: ${interests.join(", ")}.` : ""}
${dislikes.length > 0 ? `You dislike all of these things: ${dislikes.join(", ")}.` : ""}

LOCATION:
You are on the Discord server "${environment.guild.name}", in the #${environment.channel.name} ${environment.channel.type} channel.
${nickname !== null ? typeof nickname === "string" ? `Your preferred nickname is "${nickname}".` : `Your preferred nicknames are: ${nickname.join(", ")}.` : null}
It is currently the ${Utils.formatDate(new Date())}.

TOOLS:
If a tool requests a 'start' parameter, insert a few words of the start of the message to interact with, so it can be identified.
You can call a tool of a single type multiple times, by simply adding it multiple times to the JSON.
Make sure you never run a user's request involving tools double: check if you already acknowledged the request before executing.

REPLYING:
You can add "${Characters.Splitting}" at any point in your reply to split it at that point into multiple messages on Dscord.
ONLY REPLY to A SINGLE message in chat at a time.
If wish to not reply, reply with "${Characters.Ignore}" VERBATIM.

FORMAT:
The message format for chat history is:
"{author} ({nick}) ([reply to ...: '...']) ${Characters.Separator} {content}".

HISTORY:
You are given a chat history of previous messages in the chat and when they were sent.
Look at the timestamps to figure out when messages were sent.
You should prioritize responding to recent messages instead of reviving dead threads.
You are not forced to interact with any messages, do as you wish.

Continue now.`;
    }

    public static async chat(
        app: App,
        _options: AIProcessOptions,
        environment: AIEnvironment,
        memories: AIMemory
    ): Promise<ChatMessage[]> {
        const messages: ChatMessage[] = [];
        const features = app.config.data.settings.features;

        if (features.users) messages.push({
            role: "system", content: ChatAPI.toChatMessage(`Users currently in chat:\n${environment.history.users.map(user => `${user.name} =\n${app.ai.env.stringify(user, [ "name", "self", "bio" ])}`).join("\n")}`)
        });

        if (memories.length > 0) messages.push({
            role: "system", content: ChatAPI.toChatMessage(`Use these previous interactions (memories) if relevant to remember things, do not copy them verbatim:\n${memories.map(m => app.ai.memory.toMemoryEntry(m)).join("\n")}`)
        });

        messages.push({
            role: "system", content: ChatAPI.toChatMessage(Prompts.baseInstructions(app, environment))
        });

        for (let i = 0; i < environment.history.messages.length; i++) {
            const message = environment.history.messages[i];

            messages.push(await app.ai.toAPIMessage(environment, {
                ...message, index: i
            }));
        }

        // TODO: use?
        //const date = new Date(Date.now());
        //const formattedTime = `${date.getUTCHours().toString().padStart(2, "0")}:${date.getUTCMinutes().toString().padStart(2, "0")}`;

        return messages;
    }

    public static async work(
        app: App,
        options: AIProcessOptions,
        environment: AIEnvironment,
        _memories: AIMemory
    ): Promise<ChatMessage[]> {
        if (!options.task || !options.task.context.instructions)
            throw new Error("This shouldn't happen");

        const messages: ChatMessage[] = [];

        messages.push({
            role: "system", content: ChatAPI.toChatMessage(`
${Prompts.baseInstructions(app, environment)}

YOUR TASK:
Your task is to fulfill the following task, which you wrote down yourself to remember at ${Utils.formatDate(new Date(options.task.time))}:
""${options.task.context.instructions}""
Depending on the task description, fulfill it using tools or by simply writing a message in response in this channel.`)
        });

        for (let i = 0; i < environment.history.messages.length; i++) {
            const message = environment.history.messages[i];

            messages.push(await app.ai.toAPIMessage(environment, {
                ...message, index: i
            }));
        }

        return messages;
    }
}