import { Plugin, PluginResponse, PluginRunOptions } from "./index.js"
import { AIManager } from "../manager.js"

interface PluginInput {
    query: string
}

type PluginOutput = string

export default class SearchPlugin extends Plugin<PluginInput, PluginOutput> {
    constructor(ai: AIManager) {
        super(ai, {
            name: "searchWeb",
            description:
                "Search something in browser, use for new/unknown topics",
            parameters: {
                query: { type: "string", required: true },
            },
        })
    }

    public async run({
        data: { query },
    }: PluginRunOptions<PluginInput>): PluginResponse<PluginOutput> {
        const { results } = await this.ai.app.api.search.searchQuery({
            query,
            limit: 5,
        })

        return {
            data: `Search results for '${query}':\n${results.map((r) => `${r.title}: ${r.description.map((d) => d.text).join(" / ")}`).join("\n")}`,
        }
    }
}
