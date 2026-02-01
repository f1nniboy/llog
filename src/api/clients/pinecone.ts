import { Hit } from "@pinecone-database/pinecone/dist/pinecone-generated-ts-fetch/db_data/index.js"
import {
    Pinecone,
    PineconeRecord,
    RecordMetadata,
} from "@pinecone-database/pinecone"
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
            types: ["vector", "embeddings"],
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

        if (this.usedFor("embeddings")) {
            await this.index.upsertRecords(
                values.map((v) => nativeToDbVector(v)),
            )
        } else {
            const toInsert: PineconeRecord<RecordMetadata>[] = []

            for (const v of values) {
                const embedding = await this.app.api.embeddings.getEmbedding({
                    text: v.data.text,
                })

                toInsert.push({
                    id: v.id,
                    metadata: v.data,
                    values: embedding.data,
                })
            }

            await this.index.upsert(toInsert)
        }

        return values
    }

    public async searchVector<T>(
        options: VectorSearchOptions<T>,
    ): Promise<VectorResult<T>[]> {
        assert(this.instance)
        const results: Hit[] = []

        if (this.usedFor("embeddings")) {
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
        } else {
            const embedding = await this.app.api.embeddings.getEmbedding({
                text: options.text,
            })

            results.push(
                ...(
                    await this.index.searchRecords({
                        query: {
                            vector: { values: embedding.data },
                            filter: options.filters,
                            topK: options.limit ?? 10,
                        },
                    })
                ).result.hits,
            )
        }

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
