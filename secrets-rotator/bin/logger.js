"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.reportFileLogger = void 0;
const fs = __importStar(require("fs"));
const data_1 = require("./data");
exports.reportFileLogger = {
    appendError: (message, error) => {
        // eslint-disable-next-line security/detect-non-literal-fs-filename
        fs.appendFileSync(data_1.outputFileName, `${(JSON.stringify({
            message,
            stackTrace: error.stack,
            causedByError: error.message,
            causedByErrorName: error.name,
        }))}\n`);
    },
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    appendText: (message) => fs.appendFileSync(data_1.outputFileName, `${message.toString()}\n`),
};
//# sourceMappingURL=logger.js.map