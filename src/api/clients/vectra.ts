import { LocalIndex } from "vectra"
import assert from "assert"
import path from "path"
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
    path: z.string(),
})

export default class VectraVectorClient extends APIClient<
    z.infer<typeof SettingsSchema>
> {
    private index?: LocalIndex

    constructor(app: App) {
        super(app, {
            name: "vectra",
            types: ["vector"],
            settings: SettingsSchema,
        })
    }

    public async load() {
        this.index = new LocalIndex(path.join("./", this.settings.path))

        if (!(await this.index.isIndexCreated())) {
            await this.index.createIndex()
        }

        return super.load()
    }

    public async insertVector<T>(
        values: VectorInput<T>[],
    ): Promise<VectorEntry<T>[]> {
        assert(this.index)

        for (const v of values) {
            const embedding = await this.app.api.embeddings.getEmbedding({
                text: v.data.text,
            })

            await this.index.insertItem({
                id: v.id,
                metadata: v.data,
                vector: embedding.data,
            })
        }

        return values
    }

    public async searchVector<T>(
        options: VectorSearchOptions<T>,
    ): Promise<VectorResult<T>[]> {
        assert(this.index)

        const embedding = await this.app.api.embeddings.getEmbedding({
            text: options.text,
        })

        const results = await this.index.queryItems(
            embedding.data,
            embedding.content,
            options.limit ?? 5,
        )

        return results.map<VectorResult<T>>((r) => ({
            id: r.item.id,
            data: r.item.metadata as VectorResult<T>["data"],
            score: r.score,
        }))
    }
}
