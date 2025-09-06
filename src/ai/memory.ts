import { VectorRetrieveOptions } from "../api/vector/manager.js";
import { AIManager, AIResult, Characters } from "./manager.js";
import { AIMessage } from "./types/history.js";

interface MemoryInsertOptions {
    trigger: AIMessage;
    result: AIResult;
}

export interface MemoryEntry {
    id: string;
    authorId: string;
    authorName: string;
    text: string;
    time: string;
}

export type AIMemory = MemoryEntry[]

export class MemoryManager {
    public readonly ai: AIManager;

    constructor(ai: AIManager) {
        this.ai = ai;
    }

    public async insert(options: MemoryInsertOptions) {
        await this.ai.app.api.vector.insert({
            id: options.trigger.id,
            time: options.trigger.when,
            authorId: options.trigger.author.id,
            authorName: options.trigger.author.name,
            text: this.formatMemoryEntry(options)
        });
    }

    public async retrieve(options: VectorRetrieveOptions): Promise<AIMemory> {
        const results = await this.ai.app.api.vector.retrieve(options);

        return results.map(r => ({
            id: r.id,
            authorId: r.authorId,
            authorName: r.authorName,
            text: r.text,
            time: r.time
        }));
    }

    public toMemoryEntry(entry: MemoryEntry) {
        return `=== INTERACTION with ${entry.authorName}: ===\n${entry.text}\n=== END INTERACTION ===`
    }

    private formatMemoryEntry({ trigger, result }: MemoryInsertOptions) {
        return `${this.ai.toHistoryEntry(trigger)}\n${Characters.Self}: ${result.content}`;
    }
}