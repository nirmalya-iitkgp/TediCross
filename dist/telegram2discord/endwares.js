"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleEdits = exports.relayMessage = exports.leftChatMember = exports.newChatMembers = exports.chatinfo = void 0;
const ramda_1 = __importDefault(require("ramda"));
const MessageMap_1 = require("../MessageMap");
const sleep_1 = require("../sleep");
const fetchDiscordChannel_1 = require("../fetchDiscordChannel");
const helpers_1 = require("./helpers");
const From_1 = require("./From");
/***********
 * Helpers *
 ***********/
/**
 * Makes an endware function be handled by all bridges it applies to. Curried
 *
 * @param func	The message handler to wrap
 * @param ctx	The Telegraf context
 */
const createMessageHandler = ramda_1.default.curry((func, ctx) => {
    // Wait for the Discord bot to become ready
    ctx.TediCross.dcBot.ready.then(() => ramda_1.default.forEach(bridge => func(ctx, bridge))(ctx.tediCross.bridges));
});
/*************************
 * The endware functions *
 *************************/
/**
 * Replies to a message with info about the chat
 *
 * @param ctx	The Telegraf context
 * @param ctx.tediCross	The TediCross object on the context
 * @param ctx.tediCross.message	The message to reply to
 * @param ctx.tediCross.message.chat	The object of the chat the message is from
 * @param ctx.tediCross.message.chat.id	ID of the chat the message is from
 */
const chatinfo = (ctx, next) => {
    if (ctx.tediCross.message.text === "/chatinfo") {
        // Reply with the info
        ctx.reply(`chatID: ${ctx.tediCross.message.chat.id}`)
            // Wait some time
            .then(sleep_1.sleepOneMinute)
            // Delete the info and the command
            .then(message => Promise.all([
            // Delete the info
            (0, helpers_1.deleteMessage)(ctx, message),
            // Delete the command
            ctx.deleteMessage()
        ]))
            .catch(helpers_1.ignoreAlreadyDeletedError);
    }
    else {
        next();
    }
};
exports.chatinfo = chatinfo;
/**
 * Handles users joining chats
 *
 * @param ctx The Telegraf context
 * @param ctx.tediCross.message The Telegram message received
 * @param ctx.tediCross.message.new_chat_members List of the users who joined the chat
 * @param ctx.TediCross The global TediCross context of the message
 */
exports.newChatMembers = createMessageHandler((ctx, bridge) => 
// Notify Discord about each user
ramda_1.default.forEach(user => {
    // Make the text to send
    const from = (0, From_1.createFromObjFromUser)(user);
    const text = `**${from.firstName} (${ramda_1.default.defaultTo("No username", from.username)})** joined the Telegram side of the chat`;
    // Pass it on
    ctx.TediCross.dcBot.ready
        .then(() => (0, fetchDiscordChannel_1.fetchDiscordChannel)(ctx.TediCross.dcBot, bridge).then(channel => channel.send(text)))
        .catch((err) => console.error(`Could not tell Discord about a new chat member on bridge ${bridge.name}: ${err.message}`));
})(ctx.tediCross.message.new_chat_members));
/**
 * Handles users leaving chats
 *
 * @param ctx The Telegraf context
 * @param ctx.tediCross The TediCross context of the message
 * @param ctx.tediCross.message The Telegram message received
 * @param ctx.tediCross.message.left_chat_member The user object of the user who left
 * @param ctx.TediCross The global TediCross context of the message
 */
exports.leftChatMember = createMessageHandler((ctx, bridge) => {
    // Make the text to send
    const from = (0, From_1.createFromObjFromUser)(ctx.tediCross.message.left_chat_member);
    const text = `**${from.firstName} (${ramda_1.default.defaultTo("No username", from.username)})** left the Telegram side of the chat`;
    // Pass it on
    ctx.TediCross.dcBot.ready
        .then(() => (0, fetchDiscordChannel_1.fetchDiscordChannel)(ctx.TediCross.dcBot, bridge).then(channel => channel.send(text)))
        .catch((err) => console.error(`Could not tell Discord about a chat member who left on bridge ${bridge.name}: ${err.message}`));
});
/**
 * Relays a message from Telegram to Discord
 *
 * @param ctx The Telegraf context
 * @param ctx.tediCross	The TediCross context of the message
 * @param ctx.TediCross	The global TediCross context of the message
 */
const relayMessage = (ctx) => ramda_1.default.forEach(async (prepared) => {
    try {
        // Discord doesn't handle messages longer than 2000 characters. Split it up into chunks that big
        const messageText = prepared.header + "\n" + prepared.text;
        let chunks = ramda_1.default.splitEvery(2000, messageText);
        // Wait for the Discord bot to become ready
        await ctx.TediCross.dcBot.ready;
        // Get the channel to send to
        const channel = await (0, fetchDiscordChannel_1.fetchDiscordChannel)(ctx.TediCross.dcBot, prepared.bridge);
        let dcMessage = null;
        // Send the attachment first, if there is one
        if (!ramda_1.default.isNil(prepared.file)) {
            try {
                dcMessage = await channel.send({
                    content: ramda_1.default.head(chunks),
                    files: [prepared.file]
                });
                chunks = ramda_1.default.tail(chunks);
            }
            catch (err) {
                if (err.message === "Request entity too large") {
                    dcMessage = await channel.send(`***${prepared.senderName}** on Telegram sent a file, but it was too large for Discord. If you want it, ask them to send it some other way*`);
                }
                else {
                    throw err;
                }
            }
        }
        // Send the rest in serial
        dcMessage = await ramda_1.default.reduce((p, chunk) => p.then(() => channel.send(chunk)), Promise.resolve(dcMessage), chunks);
        // Make the mapping so future edits can work XXX Only the last chunk is considered
        ctx.TediCross.messageMap.insert(MessageMap_1.MessageMap.TELEGRAM_TO_DISCORD, prepared.bridge, ctx.tediCross.messageId, dcMessage?.id);
    }
    catch (err) {
        console.error(`Could not relay a message to Discord on bridge ${prepared.bridge.name}: ${err.message}`);
    }
})(ctx.tediCross.prepared);
exports.relayMessage = relayMessage;
/**
 * Handles message edits
 *
 * @param ctx	The Telegraf context
 */
exports.handleEdits = createMessageHandler(async (ctx, bridge) => {
    // Function to "delete" a message on Discord
    const del = async (ctx, bridge) => {
        try {
            // Find the ID of this message on Discord
            const [dcMessageId] = ctx.TediCross.messageMap.getCorresponding(MessageMap_1.MessageMap.TELEGRAM_TO_DISCORD, bridge, ctx.tediCross.message.message_id);
            // Get the channel to delete on
            const channel = await (0, fetchDiscordChannel_1.fetchDiscordChannel)(ctx.TediCross.dcBot, bridge);
            // Delete it on Discord
            const dp = channel.bulkDelete([dcMessageId]);
            // Delete it on Telegram
            const tp = ctx.deleteMessage();
            await Promise.all([dp, tp]);
        }
        catch (err) {
            console.error(`Could not cross-delete message from Telegram to Discord on bridge ${bridge.name}: ${err.message}`);
        }
    };
    // Function to edit a message on Discord
    const edit = async (ctx, bridge) => {
        try {
            const tgMessage = ctx.tediCross.message;
            // Find the ID of this message on Discord
            const [dcMessageId] = ctx.TediCross.messageMap.getCorresponding(MessageMap_1.MessageMap.TELEGRAM_TO_DISCORD, bridge, tgMessage.message_id);
            // Wait for the Discord bot to become ready
            await ctx.TediCross.dcBot.ready;
            // Get the messages from Discord
            const dcMessage = await (0, fetchDiscordChannel_1.fetchDiscordChannel)(ctx.TediCross.dcBot, bridge).then(channel => channel.messages.fetch(dcMessageId));
            ramda_1.default.forEach(async (prepared) => {
                // Discord doesn't handle messages longer than 2000 characters. Take only the first 2000
                const messageText = ramda_1.default.slice(0, 2000, prepared.header + "\n" + prepared.text);
                // Send them in serial, with the attachment first, if there is one
                if (typeof dcMessage.edit !== "function") {
                    console.error("dcMessage.edit is not a function");
                }
                else {
                    await dcMessage.edit({
                        content: messageText,
                        attachment: prepared.attachment
                    });
                }
            })(ctx.tediCross.prepared);
        }
        catch (err) {
            // Log it
            console.error(`Could not cross-edit message from Telegram to Discord on bridge ${bridge.name}: ${err.message}`);
        }
    };
    // Check if this is a "delete", meaning it has been edited to a single dot
    if (bridge.telegram.crossDeleteOnDiscord &&
        ctx.tediCross.text.raw === "." &&
        ramda_1.default.isEmpty(ctx.tediCross.text.entities)) {
        await del(ctx, bridge);
    }
    else {
        await edit(ctx, bridge);
    }
});
//# sourceMappingURL=endwares.js.map