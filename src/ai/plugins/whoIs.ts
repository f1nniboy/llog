import { Plugin, PluginResponse, PluginRunOptions } from "./index.js";
import { AIManager } from "../manager.js";

interface PluginInput {
    name: string;
}

type PluginOutput = string

export default class WhoIsPlugin extends Plugin<PluginInput, PluginOutput> {
    constructor(ai: AIManager) {
        super(ai, {
            name: "whoIs",
            description: "Get info about a member of the server, using their user or nick name, USE IF YOU DON'T HAVE DATA ABOUT THE USER",
            triggers: [ "who", "user", "info", "get" ],
            parameters: {
                name: { type: "string", description: "User or nick name of the user to get info about", required: true }
            }
        });
    }

    public async run({ data: { name }, environment: { guild: { original: guild } } }: PluginRunOptions<PluginInput>): PluginResponse<PluginOutput> {
        const target = guild.members.cache.find(m => m.user.username === name || m.nickname === name);
        if (!target) throw new Error("User doesn't exist");

        const user = await this.ai.env.user(target);

        return {
            data: this.ai.env.stringify(user, [ "self" ])
        };
    }
}