"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCredentialsForBasicAuth = void 0;
const buffer_1 = require("buffer");
function getCredentialsForBasicAuth(config) {
    return buffer_1.Buffer.from(`${config.userName}:${config.password}`, "utf8").toString("base64");
}
exports.getCredentialsForBasicAuth = getCredentialsForBasicAuth;
//# sourceMappingURL=api.js.map