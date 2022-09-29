"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.escapeHTMLSpecialChars = exports.ignoreAlreadyDeletedError = void 0;
const ramda_1 = __importDefault(require("ramda"));
/********************
 * Make the helpers *
 ********************/
/**
 * Ignores errors arising from trying to delete an already deleted message. Rethrows other errors
 *
 * @param err The error to check
 *
 * @throws The error, if it is another type
 */
exports.ignoreAlreadyDeletedError = ramda_1.default.ifElse(ramda_1.default.propEq("message", "Unknown Message"), ramda_1.default.always(undefined), err => {
    throw err;
});
/**
 * Converts characters '&', '<' and '>' in strings into HTML safe strings
 *
 * @param text The text to escape the characters in
 *
 * @returns The escaped string
 */
exports.escapeHTMLSpecialChars = ramda_1.default.compose(ramda_1.default.replace(/>/g, "&gt;"), ramda_1.default.replace(/</g, "&lt;"), ramda_1.default.replace(/&/g, "&amp;"));
//# sourceMappingURL=helpers.js.map