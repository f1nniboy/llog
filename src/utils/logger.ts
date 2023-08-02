import chalk from "chalk";
import dayjs from "dayjs";

export type LogType = string | number | boolean | any
type LogLevelName = "INFO" | "WARN" | "ERROR" | "DEBUG"

interface LogLevel {
	name: string;
	color: string;
}

export const LogLevels: Record<LogLevelName, LogLevel> = {
	INFO:  { name: "info",  color: "#00aaff" },
	WARN:  { name: "warn",  color: "#ffff00" },
	ERROR: { name: "error", color: "#ff3300" },
	DEBUG: { name: "debug", color: "#00ffaa" }
}

export class Logger {
	public log(level: LogLevel, message: LogType[]): void {
        const now: number = Math.floor(Date.now() / 1000);
        const time: string = dayjs.unix(now).format("hh:mm A");

		const status: string = chalk.bold.hex(level.color)(level.name);
		const line: string = `${status} ${chalk.italic(chalk.gray(time))} ${chalk.gray("»")}`;

		this.print(line, ...message);
	}

	public debug(...message: LogType) { this.log(LogLevels.DEBUG, message); }
	public info(...message: LogType)  { this.log(LogLevels.INFO, message);  }
	public warn(...message: LogType)  { this.log(LogLevels.WARN, message);  }
	public error(...message: LogType) { this.log(LogLevels.ERROR, message); }

	protected print(...message: LogType): void {
		console.log(...message);
	}
}