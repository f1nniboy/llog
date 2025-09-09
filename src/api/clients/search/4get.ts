import { SearchQueryData, SearchQueryOptions, SearchResult, SearchResultDescriptionPart } from "../../types/search.js";
import { SearchAPIClient } from "../../types/client.js";
import { App } from "../../../app.js";

interface FourGetAPISettings {
    url: string;
}

interface RawSearchResult {
    status: string;
    web: ({
        title: string;
        description: { type: "text" | "quote"; value: string; }[] | string;
        url: string;
        type: "web";
    })[];
}

export default class FourGetSearchClient extends SearchAPIClient<FourGetAPISettings> {
    constructor(app: App) {
        super(app, "4get");
    }

    public async search({ query, limit }: SearchQueryOptions): Promise<SearchQueryData> {
        const url = new URL(`${this.settings.url}/api/v1/web`);
        url.searchParams.append("s", query);

        const response = await fetch(url);
        if (response.status != 200) throw new Error("Search failed");

        const data = await response.json() as RawSearchResult;
        if (data.status != "ok") throw new Error(`Search failed with error '${data.status}'`);

        const results: SearchResult[] = data.web
          .slice(undefined, limit)
          .map(({ title, description, url }) => ({
              title, url,
              description: typeof description == "string"
                ? [ { type: "text", text: description } ]
                : description.map(d => ({ type: d.type, text: d.value }))
          }));

        return {
          results
        };
    }
}