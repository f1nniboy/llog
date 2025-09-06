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

export interface OpenAIChatTool {
    type: "function";
    function: {
        name: string;
        description?: string;
        parameters: OpenAIChatFunctionParameter;
    };
}

export interface OpenAIChatRawToolCall {
    id: string;
    type: "function";
    function: {
        name: string;
        arguments: string;
    };
}

export interface OpenAIChatToolCall {
    id: string;
    name: string;
    data: object;
}