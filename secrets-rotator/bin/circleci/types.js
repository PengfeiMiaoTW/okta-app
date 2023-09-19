"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.JobStatus = void 0;
var JobStatus;
(function (JobStatus) {
    JobStatus["success"] = "success";
    JobStatus["running"] = "running";
    JobStatus["not_run"] = "not_run";
    JobStatus["failed"] = "failed";
    JobStatus["retried"] = "retried";
    JobStatus["queued"] = "queued";
    JobStatus["not_running"] = "not_running";
    JobStatus["infrastructure_fail"] = "infrastructure_fail";
    JobStatus["timedout"] = "timedout";
    JobStatus["on_hold"] = "on_hold";
    JobStatus["terminated-unknown"] = "terminated-unknown";
    JobStatus["blocked"] = "blocked";
    JobStatus["canceled"] = "canceled";
    JobStatus["unauthorized"] = "unauthorized";
})(JobStatus = exports.JobStatus || (exports.JobStatus = {}));
//# sourceMappingURL=types.js.map