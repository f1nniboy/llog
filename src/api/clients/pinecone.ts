import { Hit } from "@pinecone-database/pinecone/dist/pinecone-generated-ts-fetch/db_data/index.js"
import { Pinecone } from "@pinecone-database/pinecone"
import assert from "assert"
import chalk from "chalk"
import z from "zod"
import {
    VectorInput,
    VectorEntry,
    VectorResult,
    VectorSearchOptions,
} from "../types/vector.js"
import { APIClient } from "../types/client.js"
import { App } from "../../app.js"

const SettingsSchema = z.object({
    key: z.string(),
    indexName: z.string().optional(),
    models: z.record(z.enum(["embed", "rerank"]), z.string().optional()),
})

function dbToNativeVector<T>(input: Hit): VectorResult<T> {
    return {
        id: input._id,
        score: input._score,
        data: input.fields as VectorEntry<T>["data"],
    }
}

function nativeToDbVector<T>(input: VectorInput<T>) {
    return {
        id: input.id,
        ...input.data,
    }
}

export default class PineconeVectorClient extends APIClient<
    z.infer<typeof SettingsSchema>
> {
    private instance?: Pinecone

    constructor(app: App) {
        super(app, {
            name: "pinecone",
            types: ["vector"],
            settings: SettingsSchema,
        })
    }

    public async load() {
        this.instance = new Pinecone({
            apiKey: this.settings.key,
        })

        this.app.logger.debug(
            `Loading vector database ${chalk.bold(this.indexName)}...`,
        )

        await this.instance.createIndexForModel({
            name: this.indexName,
            cloud: "aws",
            region: "us-east-1",
            embed: {
                model: this.settings.models.embed ?? "llama-text-embed-v2",
                fieldMap: { text: "text" },
            },
            suppressConflicts: true,
            waitUntilReady: false,
        })

        this.app.logger.debug(
            `Loaded vector database ${chalk.bold(this.indexName)}.`,
        )
        return super.load()
    }

    public async insertVector<T>(
        values: VectorInput<T>[],
    ): Promise<VectorEntry<T>[]> {
        assert(this.instance)

        await this.index.upsertRecords({
            records: values.map((v) => nativeToDbVector(v)),
        })

        return values
    }

    public async searchVector<T>(
        options: VectorSearchOptions<T>,
    ): Promise<VectorResult<T>[]> {
        assert(this.instance)
        const results: Hit[] = []

        results.push(
            ...(
                await this.index.searchRecords({
                    query: {
                        inputs: { text: options.text },
                        filter: options.filters,
                        topK: options.limit ?? 10,
                    },
                })
            ).result.hits,
        )

        return results.map((r) => dbToNativeVector(r))
    }

    private get index() {
        assert(this.instance)
        return this.instance.index(this.indexName)
    }

    private get indexName() {
        return this.settings.indexName ?? "chatbot"
    }
}
