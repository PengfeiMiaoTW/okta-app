"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAWSAuthCredentials = void 0;
const cast_to_1 = require("../utils/cast-to");

function getAWSAuthCredentials(credentials) {
  return (0, cast_to_1.identity)({
    accessKeyId: credentials.accessKeyId,
    secretAccessKey: credentials.secretAccessKey,
    sessionToken: credentials.sessionToken,
  });
}

exports.getAWSAuthCredentials = getAWSAuthCredentials;
//# sourceMappingURL=authorization.js.map
