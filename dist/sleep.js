"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sleepOneMinute = exports.sleep = void 0;
const util_1 = __importDefault(require("util"));
const ramda_1 = __importDefault(require("ramda"));
const moment_1 = __importDefault(require("moment"));
/**
 * Makes a promise which resolves after a set number of milliseconds
 *
 * @param ms	Number of milliseconds to slieep
 * @param [arg]	Optional argument to resolve the promise to
 *
 * @returns Promise resolving after the given number of ms
 */
exports.sleep = util_1.default.promisify(setTimeout);
/**
 * Makes a promise which resolves after one minute
 *
 * @param [arg]	Optional argument to resolve the promise to
 *
 * @returns Promise resolving after one minute
 */
exports.sleepOneMinute = ramda_1.default.partial(exports.sleep, [moment_1.default.duration(1, "minute").asMilliseconds()]);
//# sourceMappingURL=sleep.js.map