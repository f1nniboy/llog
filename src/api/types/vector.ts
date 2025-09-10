export interface VectorEntry<T> {
    id: string;
    data: T;
}

export type VectorInput<T> = VectorEntry<T>

export type VectorResult<T> = VectorEntry<T> & {
    score: number;
}

export interface VectorSearchOptions<T> {
    field: {
        name: keyof T;
        value: string;
    };
    filters: Partial<Record<keyof T, string>>;
    limit?: number;
}