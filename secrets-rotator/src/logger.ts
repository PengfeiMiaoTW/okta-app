import * as fs from "fs";
import { outputFileName } from "./data";

export const reportFileLogger = {
  appendError: (message: string, error: Error) => {
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    fs.appendFileSync(
      outputFileName,
      `${(JSON.stringify({
        message,
        stackTrace: error.stack,
        causedByError: error.message,
        causedByErrorName: error.name,
      }))}\n`,
    );
  },
  // eslint-disable-next-line security/detect-non-literal-fs-filename
  appendText: (message: string) => fs.appendFileSync(
    outputFileName,
    `${message.toString()}\n`,
  ),
};
