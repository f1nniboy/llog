import { Plugin, PluginResponse, PluginRunOptions } from "./index.js";
import { AIMemoryEntry, MemoryTargetType } from "../memory.js";
import { AIManager } from "../manager.js";

export interface PluginInput {
    queries: {
        text: string;
        type: MemoryTargetType;
        name?: string;
    }[];
}

export type PluginOutput = string

export default class GetMemoryPlugin extends Plugin<PluginInput, PluginOutput> {
    constructor(ai: AIManager) {
        super(ai, {
            name: "getMemory",
            description: "Accepts search query objects array each with query and optional filter. Break down complex questions into sub-questions. Refine results by criteria, e.g. time / source, don't do this often.",
            parameters: {
                queries: {
                    type: "array",
                    items: {
                        type: "object",
                        properties: {
                            text: {
                                type: "string",
                                description: "Text to query your memory for"
                            },
                            type: {
                                type: "string",
                                enum: [ "guild", "user", "self" ],
                                description: "Type of memory to query"
                            },
                            name: {
                                type: "string",
                                description: "Name of the Discord user or guild to query your memory for, leave empty if querying about yourself"
                            }
                        },

                        required: [ "text", "type" ]
                    }
                }
            }
        });
    }

    public async run({ data: { queries } }: PluginRunOptions<PluginInput>): PluginResponse<PluginOutput> {
        const memories: AIMemoryEntry[] = [];
        
        for (const query of queries) {
            if (query.type != "self" && !query.name) continue;
            
            const data = await this.ai.memory.retrieve({
                ...query, limit: 10
            });

            memories.push(...data);
        }

        if (memories.length > 0) {
            return {
                data: `List of memories fitting for queries '${queries.map(q => q.text).join(", ")}':\n${memories.map(m => this.ai.memory.toMemoryPromptString(m)).join("\n")}`
            };
        } else {
            return {
                data: `No memories for queries ${queries.map(q => q.text).join(", ")}`
            };
        }
    }
}