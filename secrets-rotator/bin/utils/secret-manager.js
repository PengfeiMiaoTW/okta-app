"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createBufferForSecretManager = void 0;
const buffer_1 = require("buffer");
function createBufferForSecretManager(secret) {
    const secretAsString = typeof secret === "string" ? secret : JSON.stringify(secret);
    return buffer_1.Buffer.from(secretAsString, "utf8");
}
exports.createBufferForSecretManager = createBufferForSecretManager;
//# sourceMappingURL=secret-manager.js.map