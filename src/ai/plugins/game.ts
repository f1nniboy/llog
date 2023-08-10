import { Plugin, PluginResponse, PluginRunOptions } from "./index.js";
import { AIManager } from "../manager.js";

interface PluginInput {
    action: "START" | "STOP";
    name: string;
}

type PluginOutput = string

export default class PlayGamePlugin extends Plugin<PluginInput, PluginOutput> {
    constructor(ai: AIManager) {
        super(ai, {
            name: "game",
            description: "Make it seem like you are playing a game",
            triggers: [ "play", "game" ],
            parameters: {
                action: { type: "string", description: "Whether to START or STOP playing a game", enum: [ "START", "STOP" ], required: true },
                name: { type: "string", description: "Name of the game, e.g. com.riotgames.league.wildrift - must be a valid Android package", required: true }
            }
        });
    }

    public async run({ data: { action, name } }: PluginRunOptions<PluginInput>): PluginResponse<PluginOutput> {
        try {
            await this.ai.app.client.user.setSamsungActivity(name, action);

            return {
                data: action === "START" ? `Playing the game ${name} now` : `Stopped playing the game ${name}`,
                instructions: "When talking about game, use its display name"
            };
            
        } catch (_) {
            throw new Error("Game doesn't exist");
        }
    }
}