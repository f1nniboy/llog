import z, { ZodError } from "zod"
import chalk from "chalk"
import { AppError, AppErrorType } from "./base.js"
import { ConfigPath } from "../config.js"

interface ConfigErrorIssue {
    expected?: string
    got?: string
    message?: string
    path: ConfigPath
}

export interface ConfigErrorData {
    issues: ConfigErrorIssue[]
}

export class ConfigError extends AppError<ConfigErrorData> {
    constructor(opts: ConfigErrorData) {
        super({
            data: opts,
            type: AppErrorType.Config,
        })
    }

    public static fromZod<T>(zod: ZodError<T>, basePath?: ConfigPath) {
        return new ConfigError({
            issues: zod.issues.map((i) => {
                const path: ConfigPath = [...(basePath ?? []), ...i.path]

                switch (i.code) {
                    case "invalid_type":
                        return {
                            path,
                            expected: i.expected,
                            got: i.message.split(" ").at(-1),
                        }

                    case "custom":
                        return {
                            path,
                            message: i.message,
                        }

                    default:
                        return {
                            path,
                            message: i.message,
                        }
                }
            }),
        })
    }

    public toString(): string {
        let builder: string[] = []

        builder.push(
            `${chalk.bold(this.options.data.issues.length)} ${this.options.data.issues.length > 1 ? "issues" : "issue"} found:\n`,
        )

        builder.push(
            ...this.options.data.issues.map(
                (i) => `- ${this.issueToString(i)}\n`,
            ),
        )

        return builder.join("")
    }

    private issueToString(issue: ConfigErrorIssue): string {
        let builder: string[] = []

        builder.push(`property ${chalk.bold(z.core.toDotPath(issue.path))}: `)
        if (issue.message) builder.push(issue.message)

        if (issue.expected && issue.got) {
            if (issue.got == "undefined")
                builder.push(`missing ${chalk.bold(issue.expected)}`)
            else
                builder.push(
                    `expected ${chalk.bold(issue.expected)}, got ${chalk.bold(issue.got)}`,
                )
        }

        return builder.join("")
    }
}
