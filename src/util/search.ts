interface SearchOptions {
    query: string;
    limit?: number;
}

interface SearchResult {
    url: string;
    title: string;
    description: string;
    date: string;
}

interface RawSearchResult {
    status: string;
    web: ({
        title: string;
        description: string;
        url: string;
        date: number;
        type: "web";
    })[];
}

export async function search({ query, limit }: SearchOptions): Promise<SearchResult[]> {
    /* TODO: make configurable in config */
    const url = new URL("https://4get.dorfdsl.de/api/v1/web");
    url.searchParams.append("s", query);

    const response = await fetch(url);
    if (response.status != 200) throw new Error("Search failed");

    const data = await response.json() as RawSearchResult;
    if (data.status != "ok") throw new Error(`Search failed with error ${response.status}; the search engine might be broken`);

    return data.web.slice(undefined, limit ?? 5).map(({ title, description, url, date }) => ({
        title, description, url,
        date: new Date(date).toISOString()
    }));
}