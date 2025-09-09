import { Hit } from "@pinecone-database/pinecone/dist/pinecone-generated-ts-fetch/db_data/index.js";
import { IntegratedRecord, Pinecone, RecordMetadata } from "@pinecone-database/pinecone";
import assert from "assert";
import chalk from "chalk";

import { VectorInput, VectorEntry, VectorResult, VectorSearchOptions } from "../../types/vector.js";
import { VectorAPIClient } from "../../types/client.js";
import { App } from "../../../app.js";

interface PineconeAPISettings {
    key: string;
    indexName?: string;
}

const FLATTEN_SEPARATOR = "#";

function flattenObject(obj: any, prefix: string = ""): Record<string, any> {
  const result: Record<string, any> = {};

  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      const value = obj[key];
      const newKey = prefix ? `${prefix}${FLATTEN_SEPARATOR}${key}` : key;

      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        // Recursively flatten nested objects
        Object.assign(result, flattenObject(value, newKey));
      } else {
        result[newKey] = value;
      }
    }
  }

  return result;
}

function unflattenObject(flat: Record<string, any>): any {
  const result: any = {};

  for (const key in flat) {
    if (Object.prototype.hasOwnProperty.call(flat, key)) {
      const keys = key.split(FLATTEN_SEPARATOR);
      let current = result;

      // Traverse keys to build nested structure
      for (let i = 0; i < keys.length - 1; i++) {
        const k = keys[i];
        if (!current[k]) {
          current[k] = {};
        }
        current = current[k];
      }

      // Set the value at the final key
      current[keys[keys.length - 1]] = flat[key];
    }
  }

  return result;
}

function dbToNativeVector<T>(input: Hit): VectorResult<T> {
    return {
        id: input._id,
        score: input._score,
        data: unflattenObject(input.fields)
    };
}

function nativeToDbVector<T>(input: VectorInput<T>): IntegratedRecord<RecordMetadata> {
    return {
        id: input.id,
        ...flattenObject(input.data)
    };
}

export default class PineconeVectorClient extends VectorAPIClient<PineconeAPISettings> {
    private instance?: Pinecone;

    constructor(app: App) {
        super(app, "pinecone");
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
            waitUntilReady: true
        });

        this.app.logger.debug(`Loaded vector database ${chalk.bold(this.indexName)}.`);
    }

    public async insert<T>(values: VectorInput<T>[]): Promise<VectorEntry<T>[]> {
        assert(this.instance);

        await this.index.upsertRecords(values.map(v => nativeToDbVector(v)));

        return [];
    }

    public async search<T>(options: VectorSearchOptions): Promise<VectorResult<T>[]> {
        assert(this.instance);

        const results = await this.index.searchRecords({
            query: {
                inputs: { [options.field.name]: options.field.value },
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