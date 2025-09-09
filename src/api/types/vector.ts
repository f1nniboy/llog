export interface VectorEntry<T> {
    id: string;
    data: T & {
        text: string;
    };
}

export type VectorInput<T> = VectorEntry<T>

export type VectorResult<T> = VectorEntry<T> & {
    score: number;
}

export interface VectorSearchOptions {
    field: {
        name: string;
        value: string;
    };
    limit?: number;
}