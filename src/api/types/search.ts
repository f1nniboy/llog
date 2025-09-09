export interface SearchQueryOptions {
    query: string;
    limit: number;
}

export interface SearchQueryData {
    results: SearchResult[];
}

export interface SearchResult {
    title: string;
    description: SearchResultDescriptionPart[];
    url: string;
}

export interface SearchResultDescriptionPart {
    type: "text" | "quote";
    text: string;
}

