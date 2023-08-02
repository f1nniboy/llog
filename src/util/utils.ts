import { dirname, join } from "path";
import { fileURLToPath } from "url";
import fs from "fs";

export class Utils {
	public static async search(path: string, files: string[] = []): Promise<string[]> {
		const directory: string[] = await fs.promises.readdir(path);

		for(const i in directory) {
			const file: string = directory[i];

			if ((await fs.promises.stat(`${path}/${file}`)).isDirectory()) {
				files = await this.search(`${path}/${file}`, files);

			} else {
				const __filename = fileURLToPath(import.meta.url);
				const __dirname = dirname(__filename);

				if (file !== "index.js") files.push(join(__dirname, "..", "..", path, "/", file));
			}
		}

		return files;
	}
}