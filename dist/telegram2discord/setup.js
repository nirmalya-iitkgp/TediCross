"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.setup = void 0;
const ramda_1 = __importDefault(require("ramda"));
const middlewares_1 = __importDefault(require("./middlewares"));
const sleep_1 = require("../sleep");
const telegraf = __importStar(require("telegraf"));
const endwares_1 = require("./endwares");
/***********
 * Helpers *
 ***********/
/**
 * Clears old messages on a tgBot, making sure there are no updates in the queue
 *
 * @param tgBot	The Telegram bot to clear messages on
 *
 * @returns Promise resolving to nothing when the clearing is done
 */
function clearOldMessages(tgBot, offset = -1) {
    const timeout = 0;
    const limit = 100;
    return tgBot.telegram
        .getUpdates(timeout, limit, offset, [])
        .then(ramda_1.default.ifElse(ramda_1.default.isEmpty, ramda_1.default.always(undefined), ramda_1.default.compose(newOffset => clearOldMessages(tgBot, newOffset), 
    //@ts-ignore
    ramda_1.default.add(1), ramda_1.default.prop("update_id"), ramda_1.default.last)))
        .then(() => undefined);
}
/**
 * Sets up the receiving of Telegram messages, and relaying them to Discord
 *
 * @param logger The Logger instance to log messages to
 * @param tgBot The Telegram bot
 * @param dcBot The Discord bot
 * @param messageMap Map between IDs of messages
 * @param bridgeMap Map of the bridges to use
 * @param settings The settings to use
 */
function setup(logger, tgBot, dcBot, messageMap, bridgeMap, settings) {
    //@ts-ignore
    tgBot.ready = Promise.all([
        // Get info about the bot
        tgBot.telegram.getMe(),
        // Clear old messages, if wanted. XXX Sleep 1 sec if not wanted. See issue #156
        settings.telegram.skipOldMessages ? clearOldMessages(tgBot) : (0, sleep_1.sleep)(1000)
    ])
        .then(([me]) => {
        // Log the bot's info
        logger.info(`Telegram: ${me.username} (${me.id})`);
        // Set keeping track of where the "This is an instance of TediCross..." has been sent the last minute
        const antiInfoSpamSet = new Set();
        // Add some global context
        tgBot.context.TediCross = {
            me,
            bridgeMap,
            dcBot,
            settings,
            messageMap,
            logger,
            antiInfoSpamSet
        };
        // Apply middlewares and endwares
        tgBot.use(middlewares_1.default.addTediCrossObj);
        tgBot.use(middlewares_1.default.addMessageObj);
        tgBot.use(middlewares_1.default.addMessageId);
        tgBot.use(endwares_1.chatinfo);
        tgBot.use(middlewares_1.default.addBridgesToContext);
        tgBot.use(middlewares_1.default.informThisIsPrivateBot);
        tgBot.use(middlewares_1.default.removeD2TBridges);
        //@ts-ignore telegram expacts a second parameter
        tgBot.command(middlewares_1.default.removeBridgesIgnoringCommands);
        tgBot.on("new_chat_members", middlewares_1.default.removeBridgesIgnoringJoinMessages);
        tgBot.on("left_chat_member", middlewares_1.default.removeBridgesIgnoringLeaveMessages);
        tgBot.on("new_chat_members", endwares_1.newChatMembers);
        tgBot.on("left_chat_member", endwares_1.leftChatMember);
        tgBot.use(middlewares_1.default.addFromObj);
        tgBot.use(middlewares_1.default.addReplyObj);
        tgBot.use(middlewares_1.default.addForwardFrom);
        tgBot.use(middlewares_1.default.addTextObj);
        tgBot.use(middlewares_1.default.addFileObj);
        tgBot.use(middlewares_1.default.addFileLink);
        tgBot.use(middlewares_1.default.addPreparedObj);
        // Apply endwares
        tgBot.on(["edited_message", "edited_channel_post"], endwares_1.handleEdits);
        tgBot.use(endwares_1.relayMessage);
        // Don't crash on errors
        tgBot.catch((err) => {
            // The docs says timeout errors should always be rethrown
            // @ts-ignore TODO: Telefraf does not exprt the TimoutError, alternative implementation needed
            if (err instanceof telegraf.TimeoutError) {
                throw err;
            }
            // Log other errors, but don't do anything with them
            console.error(err);
        });
    })
        // Start getting updates
        //@ts-ignore TODO: startPooling is a private method. Maybe use .launch() instead
        .then(() => tgBot.startPolling());
}
exports.setup = setup;
//# sourceMappingURL=setup.js.map