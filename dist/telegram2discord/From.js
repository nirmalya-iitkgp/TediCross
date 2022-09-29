"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.makeDisplayName = exports.createFromObjFromChat = exports.createFromObjFromUser = exports.createFromObjFromMessage = exports.createFromObj = void 0;
const ramda_1 = __importDefault(require("ramda"));
/**
 * Creates a new From object
 *
 * @param firstName First name of the sender
 * @param [lastName] Last name of the sender
 * @param [username] Username of the sender
 *
 * @returns {From}	The From object
 *
 * @memberof From
 */
function createFromObj(firstName, lastName, username) {
    return {
        firstName,
        lastName,
        username
    };
}
exports.createFromObj = createFromObj;
/**
 * Creates a new From object from a Telegram message
 *
 * @param message The Telegram message to create the from object from
 *
 * @returns The from object
 */
function createFromObjFromMessage(message) {
    return ramda_1.default.ifElse(
    // Check if the `from` object exists
    ramda_1.default.compose(ramda_1.default.isNil, ramda_1.default.prop("from")), 
    // This message is from a channel
    message => createFromObj(message.chat.title, "", ""), 
    // This message is from a user
    ramda_1.default.compose(createFromObjFromUser, ramda_1.default.prop("from")))(message);
}
exports.createFromObjFromMessage = createFromObjFromMessage;
/**
 * Creates a new From object from a Telegram User object
 *
 * @param user The Telegram user object to create the from object from
 *
 * @returns The From object created from the user
 */
function createFromObjFromUser(user) {
    return createFromObj(user.first_name, user.last_name || "", user.username || "");
}
exports.createFromObjFromUser = createFromObjFromUser;
/**
 * Creates a From object from a Telegram chat object
 *
 * @param chat The Telegram chat object to create the from object from
 *
 * @returns The From object created from the chat
 */
function createFromObjFromChat(chat) {
    return createFromObj(chat.title, "", "");
}
exports.createFromObjFromChat = createFromObjFromChat;
/**
 * Makes a display name out of a from object
 *
 * @param useFirstNameInsteadOfUsername Whether or not to always use the first name instead of the username
 * @param from The from object
 *
 * @returns The display name
 */
function makeDisplayName(useFirstNameInsteadOfUsername, from) {
    return ramda_1.default.ifElse(from => useFirstNameInsteadOfUsername || ramda_1.default.isNil(from.username), ramda_1.default.prop("firstName"), ramda_1.default.prop("username"))(from);
}
exports.makeDisplayName = makeDisplayName;
//# sourceMappingURL=From.js.map