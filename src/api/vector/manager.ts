import { Pinecone } from "@pinecone-database/pinecone";
import chalk from "chalk";

import { AIMemory, MemoryEntry } from "../../ai/memory.js";
import { App } from "../../app.js";

export interface VectorRetrieveOptions {
    query: string;
    limit?: number;
}

export class VectorAPI {
    private readonly app: App;
    private client: Pinecone;

    constructor(app: App) {
        this.app = app;
        this.client = undefined!;
    }

    public async load() {
        if (!this.app.config.data.keys.pinecone) throw new Error();

        this.client = new Pinecone({
            apiKey: this.app.config.data.keys.pinecone
        });

        this.app.logger.debug(`Loading vector database ${chalk.bold(this.indexName)}...`);

        await this.client.createIndexForModel({
            name: this.indexName,
            cloud: "aws",
            region: "us-east-1",
            embed: {
                model: "llama-text-embed-v2",
                fieldMap: { text: "chunk_text" }
            },
            suppressConflicts: true,
            waitUntilReady: true
        });

        this.app.logger.debug(`Loaded vector database ${chalk.bold(this.indexName)}.`);
    }

    public async insert(data: MemoryEntry) {
        await this.index.upsertRecords([
            {
                _id: data.id,
                chunk_text: data.text,
                authorId: data.authorId,
                channelId: data.channelId,
                guildId: data.guildId,
                pluginName: data.pluginName as any, 
                pluginParams: data.pluginParams as any,
                time: data.time 
            }
        ]);
    };

    public async retrieve(data: VectorRetrieveOptions): Promise<AIMemory> {
        const results = await this.index.searchRecords({
            query: {
                inputs: { text: data.query },
                topK: data.limit ?? 10
            }
        });

        return results.result.hits.map(r => {
            const fields = r.fields as any;

            return {
                id: r._id,
                text: fields.chunk_text,
                authorId: fields.authorId,
                authorName: fields.authorName,
                pluginName: fields.pluginName,
                pluginParams: fields.pluginParams,
                channelId: fields.channelId,
                guildId: fields.guildId,
                time: fields.time
            };
        });
    }

    private get index() {
        return this.client.index(this.indexName);
    }

    private get indexName() {
        /* TODO: make configurable in config */
        return "chatbot-1";
    }
}