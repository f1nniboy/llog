import { GuildMember } from "discord.js-selfbot-v13";

import { Plugin, PluginCheckOptions, PluginResponse, PluginRunOptions } from "./index.js";
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
            name: "updateUser",
            description: "Update user or self on guild",
            triggers: [ "nick", "time out", "timeout", "rename", "update", "shut up", "still" ],
            parameters: {
                name: { type: "string", required: true },
                nick: { type: "string", required: false },
                timeout: { type: "number", description: "in seconds, null to remove", required: false }
            }
        });
    }

    public async run({ data: { name, nick, timeout }, environment }: PluginRunOptions<PluginInput>): PluginResponse<PluginOutput> {
        if (!environment.guild) throw new Error("Can only be used on guilds");
        const { self: { original: self }, guild: { original: guild } } = environment;

        const target: GuildMember | null = guild.members.cache.find(m => m.user.username === name) ?? null;
        if (target === null) throw new Error("User doesn't exist");

        if (nick) {
            //if (target.id !== self.id && !self.permissions.has("MANAGE_NICKNAMES")) throw new Error("Can't change the nickname of other users");
            //if (target.id === self.id && !self.permissions.has("CHANGE_NICKNAME")) throw new Error("Can't change the nickname of myself");

            await target.setNickname(nick.slice(undefined, 31));
            return { data: `Changed nickname of ${target.id === this.ai.app.id ? "yourself" : name} to ${nick}` };
        }

        if (timeout && target.id !== this.ai.app.id) {
            //if (!self.permissions.has("MODERATE_MEMBERS")) throw new Error("Can't time out users due to missing permissions");
            if (target.permissions.has("MODERATE_MEMBERS")) throw new Error("Can't time out moderators due to them having higher permissions");

            await target.timeout(timeout * 1000);
            return { data: `Timed out ${name} for ${timeout} seconds` };
        }
    }

    public check({ environment }: PluginCheckOptions): boolean {
        return environment.guild != undefined;
    }
}