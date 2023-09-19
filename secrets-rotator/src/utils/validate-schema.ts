import Ajv from "ajv";
import { configFileSchema } from "../schema/config-file";
import { getConfigData } from "../rotator";
import addCustomErrorMessages from "ajv-errors";
import addFormats from "ajv-formats";
import getDef from "ajv-keywords/dist/definitions/uniqueItemProperties";


export const validateJsonSchema = (data: unknown) => {
  const schemaValidator = new Ajv({
    allErrors: true,
  });
  addCustomErrorMessages(schemaValidator);
  schemaValidator.addKeyword(getDef());
  schemaValidator.addKeyword("example");
  addFormats(schemaValidator);
  const validate = schemaValidator.compile(configFileSchema);
  if (!validate(data)) {
    throw new Error(JSON.stringify((validate.errors).map(
      (error) =>
        error.params.failingKeyword !== "then" ?
          (error.params.allowedValues ? `${error.message} ` + `${error.params.allowedValues} ` + "in " + `${error.instancePath} `
            // eslint-disable-next-line unicorn/no-nested-ternary
            : error.params.allowedValue ? `${error.message} ` + `${error.params.allowedValue} ` + "in " + `${error.instancePath} `
              : `${error.message} ` + "in " + `${error.instancePath} `) : "").filter((errorMessage) => errorMessage)));
  }
  return true;
};

export const validateConfigFileSchema = async (configFilePath: string) => {
  try {
    console.info("Validating config file schema");
    const configFileData = await getConfigData(configFilePath);
    validateJsonSchema(configFileData);
    console.info("Schema validation successful");
  } catch (error) {
    console.info("Schema validation failed");
    throw error;
  }
};
