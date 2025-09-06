export interface OpenAIChatFunctionParameter {
    /** Type of the parameter */
    type: "object" | "string" | "number" | "boolean";

    /** Description of the parameter */
    description?: string;

    /** A list of allowed options for the parameter */
    enum?: string[];

    /** Properties, for an `object` parameter */
    properties?: Record<string, OpenAIChatFunctionParameter>;

    /* A list of required properties, for an `object` parameter */
    required?: string[];
}

export interface OpenAIChatFunction {
    name: string;
    description?: string;
    parameters: OpenAIChatFunctionParameter;
}

export interface OpenAIChatRawFunctionCall {
    name: string;
    arguments: string;
}

export interface OpenAIChatFunctionCall {
    name: string;
    data: object;
}