export interface VectorEntry<T> {
    id: string
    data: T & { text: string }
}

export type VectorInput<T> = VectorEntry<T>

export type VectorResult<T> = VectorEntry<T> & {
    score: number
}

export interface VectorSearchOptions<T> {
    text: string
    filters?: Partial<Record<keyof T, string>>
    limit?: number
}
