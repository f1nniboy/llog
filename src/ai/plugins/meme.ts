import { MessageAttachment } from "discord.js-selfbot-v13";
import fetch from "node-fetch";

import { Plugin, PluginResponse, PluginRunOptions } from "./index.js";
import { AIManager } from "../manager.js";

interface RedditPost {
    title: string;
    url: string;
}

interface RawRedditPost {
    title: string;
    url: string;
    nsfw: boolean;
}

type PluginInput = {
    r: string;
}

type PluginOutput = RedditPost

export default class MemePlugin extends Plugin<PluginInput, PluginOutput> {
    constructor(ai: AIManager) {
        super(ai, {
            name: "meme",
            description: "Send a funny meme/shitpost in the channel",
            triggers: [ "meme", "shitpost", "shit post", "joke", "picture", "post", "send" ],
            parameters: {
                r: { type: "string", description: "Which subreddit to use, OPTIONAL", required: false }
            }
        });
    }

    public async run({ data }: PluginRunOptions<PluginInput>): PluginResponse<PluginOutput> {
        const r: string = data.r ?? "shitposting";
        let response = await fetch(`https://meme-api.com/gimme/${r}/1`);

        const raw: { memes: [ RawRedditPost ] } = await response.json() as any;
        const rawPost: RawRedditPost = raw.memes[0];

        if (rawPost.nsfw) throw new Error("Cannot show NSFW posts");

        const post: RedditPost = {
            title: rawPost.title,
            url: rawPost.url
        };

        /* Fetch the image data. */
        response = await fetch(post.url);
        const image = Buffer.from(await response.arrayBuffer());

        /* Extension of the image URL */
        const extension = post.url.split(".").pop()!;

        return {
            attachments: [
                new MessageAttachment(image).setName(`${post.title}.${extension}`)
            ],

            data: post, instant: true
        };
    }
}