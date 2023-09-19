"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateConfigFileSchema = exports.validateJsonSchema = void 0;
const ajv_1 = __importDefault(require("ajv"));
const config_file_1 = require("../schema/config-file");
const rotator_1 = require("../rotator");
const ajv_errors_1 = __importDefault(require("ajv-errors"));
const ajv_formats_1 = __importDefault(require("ajv-formats"));
const uniqueItemProperties_1 = __importDefault(require("ajv-keywords/dist/definitions/uniqueItemProperties"));
const validateJsonSchema = (data) => {
    const schemaValidator = new ajv_1.default({
        allErrors: true,
    });
    (0, ajv_errors_1.default)(schemaValidator);
    schemaValidator.addKeyword((0, uniqueItemProperties_1.default)());
    schemaValidator.addKeyword("example");
    (0, ajv_formats_1.default)(schemaValidator);
    const validate = schemaValidator.compile(config_file_1.configFileSchema);
    if (!validate(data)) {
        throw new Error(JSON.stringify((validate.errors).map((error) => error.params.failingKeyword !== "then" ?
            (error.params.allowedValues ? `${error.message} ` + `${error.params.allowedValues} ` + "in " + `${error.instancePath} `
                // eslint-disable-next-line unicorn/no-nested-ternary
                : error.params.allowedValue ? `${error.message} ` + `${error.params.allowedValue} ` + "in " + `${error.instancePath} `
                    : `${error.message} ` + "in " + `${error.instancePath} `) : "").filter((errorMessage) => errorMessage)));
    }
    return true;
};
exports.validateJsonSchema = validateJsonSchema;
const validateConfigFileSchema = (configFilePath) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        console.info("Validating config file schema");
        const configFileData = yield (0, rotator_1.getConfigData)(configFilePath);
        (0, exports.validateJsonSchema)(configFileData);
        console.info("Schema validation successful");
    }
    catch (error) {
        console.info("Schema validation failed");
        throw error;
    }
});
exports.validateConfigFileSchema = validateConfigFileSchema;
//# sourceMappingURL=validate-schema.js.map