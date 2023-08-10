import { GuildMember } from "discord.js-selfbot-v13";

import { Plugin, PluginResponse, PluginRunOptions } from "./index.js";
import { AIManager } from "../manager.js";

interface PluginInput {
    name: string;
    nick?: string;
    timeout?: number | null;
}

type PluginOutput = string

export default class UpdateUserPlugin extends Plugin<PluginInput, PluginOutput> {
    constructor(ai: AIManager) {
        super(ai, {
            name: "user",
            description: "Update a user or yourself on the server, you don't have to specify all params",
            triggers: [ "nick", "time out", "timeout", "rename", "update", "shut up", "still" ],
            parameters: {
                name: { type: "string", description: "Which user to modify", required: true },
                nick: { type: "string", description: "New nickname for the user", required: false },
                timeout: { type: "number", description: "How long to time the user out, in seconds, null to remove", required: true }
            }
        });
    }

    public async run({ data: { name, nick, timeout }, environment: { self: { original: self }, guild: { original: guild } } }: PluginRunOptions<PluginInput>): PluginResponse<PluginOutput> {
        const target: GuildMember | null = guild.members.cache.find(m => m.user.username === name) ?? null;
        if (target === null) throw new Error("User doesn't exist");

        if (nick) {
            if (target.id !== self.id && !self.permissions.has("MANAGE_NICKNAMES")) throw new Error("Can't change the nickname of other users");
            if (target.id === self.id && !self.permissions.has("CHANGE_NICKNAME")) throw new Error("Can't change the nickname of myself");

            await target.setNickname(nick.slice(undefined, 31));
            return { data: `Changed nickname of ${target.id === this.ai.app.client.user.id ? "yourself" : name} to ${nick}` };
        }

        if (timeout && target.id !== this.ai.app.client.user.id) {
            if (!self.permissions.has("MODERATE_MEMBERS")) throw new Error("Can't time out users due to missing permissions");
            if (target.permissions.has("MODERATE_MEMBERS")) throw new Error("Can't time out moderators");

            await target.timeout(timeout * 1000);
            return { data: `Timed out ${name} for ${timeout} seconds` };
        }
    }
}