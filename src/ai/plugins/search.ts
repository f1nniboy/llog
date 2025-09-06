import { Plugin, PluginResponse, PluginRunOptions } from "./index.js";
import { AIManager } from "../manager.js";
import { search } from "../../util/search.js";

interface PluginInput {
    query: string;
}

type PluginOutput = string

export default class SearchPlugin extends Plugin<PluginInput, PluginOutput> {
    constructor(ai: AIManager) {
        super(ai, {
            name: "searchWeb",
            description: "Search for something on Google in your browser. Use this for searching newly available information or topics you don't know about",
            triggers: [ "search", "browse", "check" ],
            parameters: {
                query: { type: "string", description: "What to search for", required: true },
            }
        });
    }

    public async run({ data: { query } }: PluginRunOptions<PluginInput>): PluginResponse<PluginOutput> {
        const results = await search({ query });

        return {
            data: `Search results for '${query}':\n${results.map(r => `${r.title}: ${r.description} (at ${r.date}) [${r.url}]`).join("\n")}`,
            instructions: "You received these search results from your browser by searching the query"
        };
    }
}