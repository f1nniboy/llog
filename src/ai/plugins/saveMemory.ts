import assert from "assert"
import { Plugin, PluginResponse, PluginRunOptions } from "./index.js"
import { MemoryTargetType } from "../memory.js"
import { AIManager } from "../manager.js"

interface PluginInput {
    targets: {
        text: string
        type: MemoryTargetType
        name?: string
    }[]
}

type PluginOutput = string

export default class SaveMemoryPlugin extends Plugin<
    PluginInput,
    PluginOutput
> {
    constructor(ai: AIManager) {
        super(ai, {
            name: "saveMemory",
            description:
                "Save chat information, can save multiple memories at a time, only save related interactions/things per entry",
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
                                enum: ["guild", "user", "self"],
                            },
                            name: {
                                type: "string",
                                description:
                                    "Name of user or guild to remember in memory",
                            },
                        },

                        required: ["text", "type"],
                    },
                },
            },
        })
    }

    public async run({
        data: { targets },
    }: PluginRunOptions<PluginInput>): PluginResponse<PluginOutput> {
        const inserted = await this.ai.memory.insert({
            entries: targets.map((t) => ({
                targetType: t.type,
                targetName: t.name,
                text: t.text,
                time: new Date().toISOString(),
            })),
        })

        assert(inserted)

        return {
            data: `New memory added, you don't have to mention:\n${inserted.map((t) => `${this.ai.memory.toMemoryPromptString(t)}`).join("\n")}`,
        }
    }

    public check() {
        return (
            this.ai.app.config.feature("memory").enable &&
            this.ai.app.api.vector != undefined
        )
    }
}
