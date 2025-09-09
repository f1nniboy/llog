import { Plugin, PluginResponse, PluginRunOptions } from "./index.js";
import { MemoryTargetType } from "../memory.js";
import { AIManager } from "../manager.js";

interface PluginInput {
    targets: {
        text: string;
        type: MemoryTargetType;
        name?: string;
    }[];
}

type PluginOutput = string

export default class SaveMemoryPlugin extends Plugin<PluginInput, PluginOutput> {
    constructor(ai: AIManager) {
        super(ai, {
            name: "saveMemory",
            description: "Save chat information: about a user, Discord server or into your own ('self') memory. You can save multiple memories at a time, by adding more objects to the array. Only save related interactions/things per array entry.",
            parameters: {
                targets: {
                    type: "array",
                    items: {
                        type: "object",
                        properties: {
                            text: {
                                type: "string",
                            },
                            type: {
                                type: "string",
                                enum: [ "guild", "user", "self" ],
                            },
                            name: {
                                type: "string",
                                description: "Name of the Discord user or guild to store the memory for, empty if 'self'"
                            }
                        },

                        required: [ "text", "type" ]
                    }
                }
            }
        });
    }

    public async run({ data: { targets } }: PluginRunOptions<PluginInput>): PluginResponse<PluginOutput> {
        const inserted = await this.ai.memory.insert({
            entries: targets.map(t => ({
                target: {
                    type: t.type,
                    name: t.name
                },
                text: t.text,
                time: new Date().toISOString()
            }))
        })

        return {
            data: `New memory added: ${inserted.map(t => `${this.ai.memory.toMemoryPromptString(t)}`).join("\n")}`
        };
    }
}