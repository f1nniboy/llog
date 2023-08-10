import { GuildMember } from "discord.js-selfbot-v13";

import { Plugin, PluginResponse, PluginRunOptions } from "./index.js";
import { AIManager } from "../manager.js";

interface PluginInput {
    action: "add" | "remove" | "unblock" | "block" | "list";
    name?: string;
}

type PluginOutput = string | Record<string, RelationshipType>

type RelationshipType = "NONE" | "FRIEND" | "PENDING_OUTGOING" | "PENDING_INCOMING" | "BLOCKED"

export default class RelationshipsPlugin extends Plugin<PluginInput, PluginOutput> {
    constructor(ai: AIManager) {
        super(ai, {
            name: "relationships",
            description: "Manage friends on Discord",
            triggers: [ "friend", "add", "remove", "block", "fr" ],
            parameters: {
                action: { type: "string", description: "Which action to perform", enum: [ "add", "remove", "block", "unblock", "list" ], required: true },
                name: { type: "string", description: "Name of the user to add/remove as a friend, ONLY required if action is not 'list'", required: false }
            }
        });
    }

    public async run({ data: { action, name }, environment: { guild: { original: guild } } }: PluginRunOptions<PluginInput>): PluginResponse<PluginOutput> {
        if (!name && action !== "list") throw new Error("Must specify a user");

        const target: GuildMember | null = guild.members.cache.find(m => m.user.username === name) ?? null;
        if (action !== "list" && target === null) throw new Error("User doesn't exist");

        if (target !== null) {
            const status: RelationshipType = target.user.relationships as any;

            if (action === "add") {
                if (status === "BLOCKED") await target.user.unBlock();
                else if (status === "FRIEND") throw new Error("Already friends with the user");
                else if (status === "PENDING_OUTGOING") throw new Error("Already sent friend request to the the user");
                else if (status === "PENDING_INCOMING") await target.user.setFriend();
                
                if (status !== "PENDING_INCOMING") await target.user.sendFriendRequest();
                return { data: `Sent friend request to ${name}` };
    
            } else if (action === "remove") {
                if (status !== "FRIEND") throw new Error("Not friends with the user");
                else await target.user.unFriend();
    
                return { data: `Unfriended ${name}` };
    
            } else if (action === "block") {
                if (status === "BLOCKED") throw new Error("User is already blocked");
                else await target.user.setBlock();
    
                return { data: `Blocked ${name}` };
    
            } else if (action === "unblock") {
                if (status !== "BLOCKED") throw new Error("User is not blocked");
                else await target.user.unBlock();
    
                return { data: `Unblocked ${name}` };
            }
        } else {
            if (action === "list") {
                const map = this.ai.app.client.relationships.cache;
                let obj: Record<string, RelationshipType> = {};

                const types: Record<number, RelationshipType> = {
                    0: "NONE",
                    1: "FRIEND",
                    2: "BLOCKED",
                    3: "PENDING_INCOMING",
                    4: "PENDING_OUTGOING"
                };

                for (const [ key, value ] of map.entries()) {
                    const user = this.ai.app.client.users.cache.get(key) ?? null;
                    if (user === null) continue;

                    obj[user.username] = types[value];
                }

                console.log(obj);

                return { data: obj };
            }
        }
    }
}