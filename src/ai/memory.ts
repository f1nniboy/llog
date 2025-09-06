import { VectorRetrieveOptions } from "../api/vector/manager.js";
import { AIManager, AIResult, Characters } from "./manager.js";
import { AIEnvironment } from "./types/environment.js";
import { AIMessage } from "./types/history.js";

interface MemoryInsertOptions {
    environment: AIEnvironment;
    trigger: AIMessage;
    result: AIResult;
}

export interface MemoryEntry {
    id: string;
    authorId: string;
    text: string;
    time: string;
    pluginName?: string;
    pluginParams?: string;
    channelId: string;
    guildId: string;
}

export type AIMemory = MemoryEntry[]

export class MemoryManager {
    public readonly ai: AIManager;

    constructor(ai: AIManager) {
        this.ai = ai;
    }

    public async insert(options: MemoryInsertOptions) {
        const { environment, trigger, result } = options;
        const p = result.plugins.at(0);

        await this.ai.app.api.vector.insert({
            id: trigger.id,
            time: trigger.when,
            authorId: trigger.author.id,
            pluginName: p ? p.plugin.options.name : undefined,
            pluginParams: p ? JSON.stringify(p.input) : undefined,
            channelId: environment.channel.id,
            guildId: environment.guild.id,
            text: this.formatMemoryEntry(options)
        });
    }

    public async retrieve(options: VectorRetrieveOptions): Promise<AIMemory> {
        return this.ai.app.api.vector.retrieve(options);
    }

    public toMemoryEntry(entry: MemoryEntry) {
        return `${entry.text}\n\n`;
    }

    private formatMemoryEntry({ trigger, result }: MemoryInsertOptions) {
        return `${this.ai.toHistoryEntry(trigger)}\n${this.ai.app.name}${Characters.Separator}${result.content}`;
    }
}