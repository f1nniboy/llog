import { PluginResultData } from "../plugins/index.js";

export interface AIResult {
    /** The generated content */
    content?: string;

    /** Which plugins were used */
    plugins: PluginResultData[];
}