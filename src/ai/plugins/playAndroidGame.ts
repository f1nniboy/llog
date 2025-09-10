import { Plugin, PluginCheckOptions, PluginResponse, PluginRunOptions } from "./index.js";
import { AIManager } from "../manager.js";

interface PluginInput {
    action: "START" | "STOP";
    gameId: string;
}

type PluginOutput = string

export default class PlayAndroidGamePlugin extends Plugin<PluginInput, PluginOutput> {
    constructor(ai: AIManager) {
        super(ai, {
            name: "playAndroidGame",
            description: "Make it seem like you are playing Android game",
            triggers: [ "play", "game" ],
            parameters: {
                action: { type: "string", enum: [ "START", "STOP" ], required: true },
                gameId: { type: "string", description: "Android package of game, e.g. com.riotgames.league.wildrift", required: false }
            }
        });
    }

    public async run({ data: { action, gameId } }: PluginRunOptions<PluginInput>): PluginResponse<PluginOutput> {
        try {
            await this.ai.app.client.user.setSamsungActivity(gameId, action);

            return {
                data: action === "START" ? `Playing the game ${gameId} now` : `Stopped playing the game ${gameId}`
            };
            
        } catch (_) {
            throw new Error("Game doesn't exist");
        }
    }
}