"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteMessage = exports.ignoreAlreadyDeletedError = void 0;
const ramda_1 = __importDefault(require("ramda"));
/**
 * Ignores errors arising from trying to delete an already deleted message. Rethrows other errors
 *
 * @param err The error to check
 *
 * @throws The error, if it is another type
 */
exports.ignoreAlreadyDeletedError = ramda_1.default.ifElse(ramda_1.default.propEq("description", "Bad Request: message to delete not found"), ramda_1.default.always(undefined), err => {
    throw err;
});
/**
 * Deletes a Telegram message
 *
 * @param ctx The Telegraf context to use
 * @param message The message to delete
 *
 * @returns Promise resolving when the message is deleted
 */
exports.deleteMessage = ramda_1.default.curry((ctx, { chat, message_id }) => ctx.telegram.deleteMessage(chat.id, message_id));
//# sourceMappingURL=helpers.js.map