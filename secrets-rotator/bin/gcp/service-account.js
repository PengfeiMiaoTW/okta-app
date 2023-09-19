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
exports.rotateServiceAccount = void 0;
const authorization_1 = require("./authorization");
function createServiceAccountKey(iam, serviceAccountNameWithProjectId) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            console.info("Generating new service account key.");
            const res = yield iam.projects.serviceAccounts.keys.create({
                name: serviceAccountNameWithProjectId,
            });
            const newKey = res.data;
            console.info("Successfully generated new service account key.");
            return newKey;
        }
        catch (error) {
            console.info("Failed to generate new service account key.");
            throw error;
        }
    });
}
function getAllServiceAccountKeys(iam, serviceAccountNameWithProjectId) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            console.info("Fetching all service account keys.");
            const res = yield iam.projects.serviceAccounts.keys.list({
                keyTypes: ["USER_MANAGED"],
                name: serviceAccountNameWithProjectId,
            });
            const keys = res.data.keys;
            console.info("Successfully fetched all service account keys.");
            return keys;
        }
        catch (error) {
            console.info("Failed to fetch all service account keys.");
            throw error;
        }
    });
}
function deleteServiceAccountKeys(iam, serviceAccountKeys) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            console.info("Deleting old service account keys.");
            yield Promise.all(serviceAccountKeys.map((serviceAccountKey) => (iam.projects.serviceAccounts.keys.delete({
                name: serviceAccountKey.name,
            }))));
            console.info("Successfully deleted old service account keys.");
        }
        catch (error) {
            console.info("Failed to delete old service account keys.");
            throw error;
        }
    });
}
function rotateServiceAccount(config) {
    return __awaiter(this, void 0, void 0, function* () {
        console.info("Start rotating service account keys.");
        const google = yield (0, authorization_1.initializeGoogleApis)(config.authentication);
        const iam = google.iam("v1");
        const serviceAccountNameWithProjectId = `projects/${config.projectId}/serviceAccounts/${config.serviceAccountName}`;
        const newServiceAccountKey = yield createServiceAccountKey(iam, serviceAccountNameWithProjectId);
        const serviceAccountKeyBase64Encoded = newServiceAccountKey.privateKeyData;
        const serviceAccountKeys = yield getAllServiceAccountKeys(iam, serviceAccountNameWithProjectId);
        const oldServiceAccountKeys = serviceAccountKeys.filter((serviceAccountKey) => serviceAccountKey.name !== newServiceAccountKey.name);
        yield deleteServiceAccountKeys(iam, oldServiceAccountKeys);
        console.info("Completed rotating service account keys.");
        return serviceAccountKeyBase64Encoded;
    });
}
exports.rotateServiceAccount = rotateServiceAccount;
//# sourceMappingURL=service-account.js.map