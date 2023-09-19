#!/usr/bin/env node
import yargs from "yargs";
import { decryptEncryptedReportFile, runSecretRotation } from "./rotator";
import { validateConfigFileSchema } from "./utils/validate-schema";

export function main() {
  // eslint-disable-next-line @typescript-eslint/no-unused-expressions
  yargs
    .command(
      "rotate",
      "Rotates secrets specified in the config file",
      (yarg) => yarg
        .option("config", {
          alias: "c",
          describe: "Configuration json file path",
          type: "string",
        })
        .demandOption(["config"], "Please provide the config json file path"),
      async function(argv) {
        await runSecretRotation(argv.config);
      },
    )
    .command(
      "validate-schema",
      "validate specified config file schema",
      (yarg) => yarg
        .option("config", {
          alias: "c",
          describe: "configuration json file path",
          type: "string",
        })
        .demandOption(["config"], "please provide the config json file path"),
      async function(argv) {
        await validateConfigFileSchema(argv.config);
      },
    )
    .command(
      "decrypt",
      "Decrypts encrypted report file",
      (yarg) => yarg
        .option("report", {
          alias: "r",
          describe: "Report file path",
          type: "string",
        })
        .demandOption(["report"], "Please provide the encrypted report file path"),
      async function(argv) {
        await decryptEncryptedReportFile(argv.report);
      },
    )
    .demandCommand()
    .help()
    .argv;
}

main();
