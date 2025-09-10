import { Hit } from "@pinecone-database/pinecone/dist/pinecone-generated-ts-fetch/db_data/index.js";
import { IntegratedRecord, Pinecone, RecordMetadata } from "@pinecone-database/pinecone";
import assert from "assert";
import chalk from "chalk";
import z from "zod";

import { VectorInput, VectorEntry, VectorResult, VectorSearchOptions } from "../../types/vector.js";
import { VectorAPIClient } from "../../types/client.js";
import { App } from "../../../app.js";

const SettingsSchema = z.object({
  key: z.string(),
  indexName: z.string().optional()
});

function dbToNativeVector<T>(input: Hit): VectorResult<T> {
    return {
        id: input._id,
        score: input._score,
        data: input.fields as T
    };
}

function nativeToDbVector<T>(input: VectorInput<T>): IntegratedRecord<RecordMetadata> {
    return {
        id: input.id, ...input.data
    };
}

export default class PineconeVectorClient extends VectorAPIClient<z.infer<typeof SettingsSchema>> {
    private instance?: Pinecone;

    constructor(app: App) {
        super(app, "pinecone", SettingsSchema);
    }

    public async load() {
        this.instance = new Pinecone({
            apiKey: this.settings.key
        });

       this.app.logger.debug(`Loading vector database ${chalk.bold(this.indexName)}...`);

        await this.instance.createIndexForModel({
            name: this.indexName,
            cloud: "aws",
            region: "us-east-1",
            embed: {
                model: "llama-text-embed-v2",
                fieldMap: { text: "text" }
            },
            suppressConflicts: true,
            waitUntilReady: false
        });

        this.app.logger.debug(`Loaded vector database ${chalk.bold(this.indexName)}.`);
    }

    public async insert<T>(values: VectorInput<T>[]): Promise<VectorEntry<T>[]> {
        assert(this.instance);

        await this.index.upsertRecords(values.map(v => nativeToDbVector(v)));
        return values;
    }

    public async search<T>(options: VectorSearchOptions<T>): Promise<VectorResult<T>[]> {
        assert(this.instance);

        const results = await this.index.searchRecords({
            query: {
                inputs: { [options.field.name]: options.field.value },
                filter: options.filters,
                topK: options.limit ?? 10
            }
        });

        return results.result.hits.map(r => dbToNativeVector(r));
    }

    private get index() {
        assert(this.instance);
        return this.instance.index(this.indexName);
    }

    private get indexName() {
        return this.settings.indexName ?? "chatbot";
    }
}