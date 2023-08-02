import { readFile } from "fs/promises";
import JSON5 from "json5";

import { App } from "./app.js";

interface ConfigJSON {
    discord: {
        /** The token of the Discord account to use as a self-bot */
        token: string;
    }
}

export class Config {
    private readonly app: App;

    /* The actual config JSON data */
    private _data: ConfigJSON | null;

    constructor(app: App) {
        this.app = app;
        this._data = null;
    }

    public async load(): Promise<ConfigJSON> {
        const raw = (await readFile("./src/config.json5")).toString();
        const data: any = JSON5.parse(raw);

        this._data = data;
        return this.data;
    }

    public get data(): ConfigJSON {
        if (this._data === null) throw new Error("Configuration has not been loaded yet");
        return this._data;
    }
}