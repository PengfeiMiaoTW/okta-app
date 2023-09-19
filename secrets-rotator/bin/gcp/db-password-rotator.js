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
Object.defineProperty(exports, "__esModule", { value: true });
exports.rotatePostgresDbPassword = void 0;
const authorization_1 = require("./authorization");
function rotatePostgresDbPassword(config, password) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            console.info("Started rotating cloud sql password");
            const google = yield (0, authorization_1.initializeGoogleApis)(config.authentication);
            const sql = google.sqladmin("v1beta4");
            yield sql.users.update({
                name: config.userName,
                instance: config.instanceName,
                project: config.projectId,
                requestBody: {
                    password,
                },
            });
            console.info("Successfully rotated cloud sql password");
        }
        catch (error) {
            console.info("Failed to rotate cloud sql password");
            throw error;
        }
    });
}
exports.rotatePostgresDbPassword = rotatePostgresDbPassword;
//# sourceMappingURL=db-password-rotator.js.map