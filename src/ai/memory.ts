import { randomUUID } from "crypto";

import { AIEnvironment } from "./types/environment.js";
import { VectorEntry } from "../api/types/vector.js";
import { AIMessage } from "./types/history.js";
import { AIManager } from "./manager.js";

export type MemoryTargetType = "guild" | "user" | "self"

export interface MemoryTarget {
    type: MemoryTargetType;
    name?: string;
}

export interface MemoryInsertOptions {
    entries: Omit<AIRawMemoryEntry, "id">[];
}

export interface MemoryRetrieveOptions {
    text: string;
    target?: MemoryTarget;
    limit?: number;
}

export interface AIRawMemoryEntry {
    text: string;
    time: string;
    targetType: MemoryTargetType;
    targetName?: string;
}

export type AIMemoryEntry = VectorEntry<AIRawMemoryEntry>

export class MemoryManager {
    public readonly ai: AIManager;

    constructor(ai: AIManager) {
        this.ai = ai;
    }

    public async getRelatedMemories(environment: AIEnvironment, trigger?: AIMessage) {
        if (!trigger) return [];
        
        const queries: ({
            type: MemoryTargetType;
            name?: string;
        })[] = [
            { type: "self" }
        ];

        //if (environment.guild) queries.push({ type: "guild", name: environment.guild.name });
        if (trigger) queries.push({ type: "user", name: trigger.author.name });

        const memories: AIMemoryEntry[] = [];

        for (const query of queries) {
            const results = await this.retrieve({
                text: `${trigger.replyTo}, ${trigger.content}`,
                target: query,
                limit: 3
            });

            memories.push(...results);
        }

        return memories;
    }

    public async insert({ entries }: MemoryInsertOptions) {
        return this.ai.app.api.vector
            .insert<AIRawMemoryEntry>(entries.map(e => ({
                id: randomUUID(),
                data: e
            })));
    }

    public async retrieve(options: MemoryRetrieveOptions) {
        return this.ai.app.api.vector.search<AIRawMemoryEntry>({ 
            field: { name: "text", value: options.text },
            filters: {
                targetName: options.target?.name,
                targetType: options.target?.type
            },
            limit: options.limit
        });
    }

    public toMemoryPromptString({ data }: AIMemoryEntry) {
        return `${data.targetType != "self" ? `${data.targetType} ` : `me`}${data.targetName ? data.targetName : ""}: '${data.text}'`;
    }
}