import { Snowflake } from "discord.js-selfbot-v13";

import { Plugin, PluginResponse, PluginRunOptions } from "./index.js";
import { AIManager } from "../manager.js";

interface PluginInput {
    which: string;
}

interface Sticker {
    name: string;
    id: Snowflake;
}

const Stickers: Sticker[] = [
    { name: "Wave", id: "749054660769218631" },
    { name: "Cry", id: "749054292937277450" },
    { name: "Thinking", id: "749046696482439188" },
    { name: "Dance", id: "749052944682582036" },
    { name: "Angry", id: "749055120263872532" },
    { name: "Hog", id: "1134585118925791343" },
    { name: "I know what you are, homophobic dog", id: "1134584368652882080" },
    { name: "Smiling cat", id: "1134585027863257240" },
    { name: "Triangle head", id: "1134585136474751017" }
]

type PluginOutput = string

export default class StickerPlugin extends Plugin<PluginInput, PluginOutput> {
    constructor(ai: AIManager) {
        super(ai, {
            name: "sticker",
            description: "Send a sticker in the channel",
            triggers: [ "sticker", "big emoji" ],
            parameters: {
                which: { type: "string", description: "Which sticker to send", enum: Stickers.map(s => s.name), required: true }
            }
        });
    }

    public async run({ data: { which } }: PluginRunOptions<PluginInput>): PluginResponse<PluginOutput> {
        const sticker = Stickers.find(s => s.name === which) ?? null;
        if (sticker === null) throw new Error("Sticker doesn't exist");

        return {
            stickers: [ sticker.id ], instant: true
        };
    }
}