"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const ramda_1 = __importDefault(require("ramda"));
const Bridge_1 = require("../bridgestuff/Bridge");
const lite_1 = __importDefault(require("mime/lite"));
const handleEntities_1 = require("./handleEntities");
const discord_js_1 = __importDefault(require("discord.js"));
const sleep_1 = require("../sleep");
const fetchDiscordChannel_1 = require("../fetchDiscordChannel");
const From_1 = require("./From");
const helpers_1 = require("./helpers");
/***********
 * Helpers *
 ***********/
/**
 * Creates a text object from a Telegram message
 *
 * @param message The message object
 *
 * @returns The text object, or undefined if no text was found
 */
function createTextObjFromMessage(ctx, message) {
    return ramda_1.default.cond([
        // Text
        [
            ramda_1.default.has("text"),
            ({ text, entities }) => ({
                raw: text,
                entities: ramda_1.default.defaultTo([], entities)
            })
        ],
        // Animation, audio, document, photo, video or voice
        [
            ramda_1.default.has("caption"),
            ({ caption, caption_entities }) => ({
                raw: caption,
                entities: ramda_1.default.defaultTo([], caption_entities)
            })
        ],
        // Stickers have an emoji instead of text
        [
            ramda_1.default.has("sticker"),
            message => ({
                raw: ramda_1.default.ifElse(() => ctx.TediCross.settings.telegram.sendEmojiWithStickers, ramda_1.default.path(["sticker", "emoji"]), ramda_1.default.always(""))(message),
                entities: []
            })
        ],
        // Locations must be turned into an URL
        [
            ramda_1.default.has("location"),
            ({ location }) => ({
                raw: `https://maps.google.com/maps?q=${location.latitude},${location.longitude}&ll=${location.latitude},${location.longitude}&z=16`,
                entities: []
            })
        ],
        // Default to undefined
        [ramda_1.default.T, ramda_1.default.always({ raw: "", entities: [] })]
    ])(message);
}
/**
 * Makes the reply text to show on Discord
 *
 * @param replyTo The replyTo object from the tediCross context
 * @param replyLength How many characters to take from the original
 * @param maxReplyLines How many lines to cut the reply text after
 *
 * @returns The reply text to display
 */
const makeReplyText = (replyTo, replyLength, maxReplyLines) => {
    const countDoublePipes = ramda_1.default.tryCatch(str => str.match(/\|\|/g).length, ramda_1.default.always(0));
    // Make the reply string
    return ramda_1.default.compose(
    // Add ellipsis if the text was cut
    ramda_1.default.ifElse(ramda_1.default.compose(ramda_1.default.equals(ramda_1.default.length(replyTo.text.raw)), ramda_1.default.length), ramda_1.default.identity, ramda_1.default.concat(ramda_1.default.__, "…")), 
    // Handle spoilers (pairs of "||" in Discord)
    //@ts-ignore
    ramda_1.default.ifElse(
    // If one of a pair of "||" has been removed
    quote => ramda_1.default.and(
    //@ts-ignore
    countDoublePipes(quote, "||") % 2 === 1, countDoublePipes(replyTo.text.raw) % 2 === 0), 
    // Add one to the end
    ramda_1.default.concat(ramda_1.default.__, "||"), 
    // Otherwise do nothing
    ramda_1.default.identity), 
    // Take only a number of lines
    ramda_1.default.join("\n"), ramda_1.default.slice(0, maxReplyLines), ramda_1.default.split("\n"), 
    // Take only a portion of the text
    ramda_1.default.slice(0, replyLength))(replyTo.text.raw);
};
/**
 * Makes a discord mention out of a username
 *
 * @param username The username to make the mention from
 * @param dcBot The Discord bot to look up the user's ID with
 * @param bridge The bridge to use
 *
 * @returns A Discord mention of the user
 */
async function makeDiscordMention(username, dcBot, bridge) {
    try {
        // Get the name of the Discord user this is a reply to
        const channel = await (0, fetchDiscordChannel_1.fetchDiscordChannel)(dcBot, bridge);
        const dcUser = await channel.members.find(ramda_1.default.propEq("displayName", username));
        return ramda_1.default.ifElse(ramda_1.default.isNil, ramda_1.default.always(username), dcUser => `<@${dcUser.id}>`)(dcUser);
    }
    catch (err) {
        // Cannot make a mention. Just return the username
        return username;
    }
}
/****************************
 * The middleware functions *
 ****************************/
/**
 * Adds a `tediCross` property to the context
 *
 * @param ctx The context to add the property to
 * @param next Function to pass control to next middleware
 */
function addTediCrossObj(ctx, next) {
    ctx.tediCross = {};
    next();
}
/**
 * Adds a message object to the tediCross context. One of the four optional arguments must be present. Requires the tediCross context to work
 *
 * @param ctx The Telegraf context
 * @param ctx.tediCross The TediCross object on the context
 * @param [ctx.channelPost]
 * @param [ctx.editedChannelPost]
 * @param [ctx.message]
 * @param [ctx.editedChannelPost]
 * @param next Function to pass control to next middleware
 */
function addMessageObj(ctx, next) {
    // Put it on the context
    ctx.tediCross.message = ramda_1.default.cond([
        // XXX I tried both R.has and R.hasIn as conditions. Neither worked for some reason
        [ctx => !ramda_1.default.isNil(ctx.update.channel_post), ramda_1.default.path(["update", "channel_post"])],
        [ctx => !ramda_1.default.isNil(ctx.update.edited_channel_post), ramda_1.default.path(["update", "edited_channel_post"])],
        [ctx => !ramda_1.default.isNil(ctx.update.message), ramda_1.default.path(["update", "message"])],
        [ctx => !ramda_1.default.isNil(ctx.update.edited_message), ramda_1.default.path(["update", "edited_message"])]
    ])(ctx);
    next();
}
/**
 * Adds the message ID as a prop to the tedicross context
 *
 * @param ctx The Telegraf context
 * @param ctx.tediCross The Tedicross object on the context
 * @param ctx.tediCross.message The message object being handled
 * @param next Function to pass control to next middleware
 */
function addMessageId(ctx, next) {
    ctx.tediCross.messageId = ctx.tediCross.message.message_id;
    next();
}
/**
 * Adds the bridges to the tediCross object on the context. Requires the tediCross context to work
 *
 * @param ctx The context to add the property to
 * @param ctx.tediCross The TediCross object on the context
 * @param ctx.TediCross The global TediCross context
 * @param ctx.TediCross.bridgeMap The bridge map of the application
 * @param next Function to pass control to next middleware
 */
function addBridgesToContext(ctx, next) {
    ctx.tediCross.bridges = ctx.TediCross.bridgeMap.fromTelegramChatId(ctx.tediCross.message.chat.id);
    next();
}
/**
 * Removes d2t bridges from the bridge list
 *
 * @param ctx The Telegraf context to use
 * @param ctx.tediCross The TediCross object on the context
 * @param ctx.tediCross.bridges The bridges the message could use
 * @param next Function to pass control to next middleware
 */
function removeD2TBridges(ctx, next) {
    ctx.tediCross.bridges = ramda_1.default.reject(ramda_1.default.propEq("direction", Bridge_1.Bridge.DIRECTION_DISCORD_TO_TELEGRAM))(ctx.tediCross.bridges);
    next();
}
/**
 * Removes bridges with the `relayCommands` flag set to false from the bridge list
 *
 * @param ctx The Telegraf context to use
 * @param ctx.tediCross The TediCross object on the context
 * @param ctx.tediCross.bridges The bridges the message could use
 * @param next Function to pass control to next middleware
 */
function removeBridgesIgnoringCommands(ctx, next) {
    //@ts-ignore
    ctx.tediCross.bridges = ramda_1.default.filter(ramda_1.default.path(["telegram", "relayCommands"]), ctx.tediCross.bridges);
    next();
}
/**
 * Removes bridges with `telegram.relayJoinMessages === false`
 *
 * @param ctx The Telegraf context to use
 * @param ctx.tediCross The TediCross object on the context
 * @param ctx.tediCross.bridges The bridges the message could use
 * @param next Function to pass control to next middleware
 */
function removeBridgesIgnoringJoinMessages(ctx, next) {
    //@ts-ignore
    ctx.tediCross.bridges = ramda_1.default.filter(ramda_1.default.path(["telegram", "relayJoinMessages"]), ctx.tediCross.bridges);
    next();
}
/**
 * Removes bridges with `telegram.relayLeaveMessages === false`
 *
 * @param ctx The Telegraf context to use
 * @param ctx.tediCross The TediCross object on the context
 * @param ctx.tediCross.bridges The bridges the message could use
 * @param next Function to pass control to next middleware
 */
function removeBridgesIgnoringLeaveMessages(ctx, next) {
    //@ts-ignore
    ctx.tediCross.bridges = ramda_1.default.filter(ramda_1.default.path(["telegram", "relayLeaveMessages"]), ctx.tediCross.bridges);
    next();
}
/**
 * Replies to the message telling the user this is a private bot if there are no bridges on the tediCross context
 *
 * @param ctx The Telegraf context
 * @param ctx.reply The context's reply function
 * @param next Function to pass control to next middleware
 */
function informThisIsPrivateBot(ctx, next) {
    ramda_1.default.ifElse(
    // If there are no bridges
    //@ts-ignore
    ramda_1.default.compose(ramda_1.default.isEmpty, ramda_1.default.path(["tediCross", "bridges"])), 
    // Inform the user, if enough time has passed since last time
    ramda_1.default.when(
    // When there is no timer for the chat in the anti spam map
    ctx => ramda_1.default.not(ctx.TediCross.antiInfoSpamSet.has(ctx.tediCross.message.chat.id)), 
    // Inform the chat this is an instance of TediCross
    ctx => {
        // Update the anti spam set
        ctx.TediCross.antiInfoSpamSet.add(ctx.tediCross.message.chat.id);
        // Send the reply
        ctx.reply("This is an instance of a [TediCross](https://github.com/TediCross/TediCross) bot, " +
            "bridging a chat in Telegram with one in Discord. " +
            "If you wish to use TediCross yourself, please download and create an instance.", {
            parse_mode: "Markdown"
        }).then(msg => 
        // Delete it again after a while
        //@ts-ignore
        (0, sleep_1.sleepOneMinute)()
            .then(() => (0, helpers_1.deleteMessage)(ctx, msg))
            .catch(helpers_1.ignoreAlreadyDeletedError)
            // Remove it from the anti spam set again
            .then(() => ctx.TediCross.antiInfoSpamSet.delete(ctx.message.chat.id)));
    }), 
    // Otherwise go to next middleware
    next)(ctx);
}
/**
 * Adds a `from` object to the tediCross context
 *
 * @param ctx The context to add the property to
 * @param ctx.tediCross The tediCross on the context
 * @param ctx.tediCross.message The message object to create the `from` object from
 * @param next Function to pass control to next middleware
 */
function addFromObj(ctx, next) {
    ctx.tediCross.from = (0, From_1.createFromObjFromMessage)(ctx.tediCross.message);
    next();
}
/**
 * Adds a `reply` object to the tediCross context, if the message is a reply
 *
 * @param ctx The context to add the property to
 * @param ctx.tediCross The tediCross on the context
 * @param ctx.tediCross.message The message object to create the `reply` object from
 * @param next Function to pass control to next middleware
 */
function addReplyObj(ctx, next) {
    const repliedToMessage = ctx.tediCross.message.reply_to_message;
    if (!ramda_1.default.isNil(repliedToMessage)) {
        // This is a reply
        const isReplyToTediCross = !ramda_1.default.isNil(repliedToMessage.from) && ramda_1.default.equals(repliedToMessage.from.id, ctx.TediCross.me.id);
        ctx.tediCross.replyTo = {
            isReplyToTediCross,
            message: repliedToMessage,
            originalFrom: (0, From_1.createFromObjFromMessage)(repliedToMessage),
            text: createTextObjFromMessage(ctx, repliedToMessage)
        };
        // Handle replies to TediCross
        if (isReplyToTediCross) {
            // Get the username of the Discord user who sent this and remove it from the text
            const split = ramda_1.default.split("\n", ctx.tediCross.replyTo.text.raw);
            ctx.tediCross.replyTo.dcUsername = ramda_1.default.head(split);
            ctx.tediCross.replyTo.text.raw = ramda_1.default.join("\n", ramda_1.default.tail(split));
            // Cut off the first entity (the bold text on the username) and reduce the offset of the rest by the length of the username and the newline
            ctx.tediCross.replyTo.text.entities = ramda_1.default.compose(ramda_1.default.map((entity) => ramda_1.default.mergeRight(entity, {
                offset: entity.offset - ctx.tediCross.replyTo.dcUsername.length - 1
            })), ramda_1.default.tail)(ctx.tediCross.replyTo.text.entities);
        }
        // Turn the original text into "<no text>" if there is no text
        if (ramda_1.default.isEmpty(ctx.tediCross.replyTo.text.raw)) {
            ctx.tediCross.replyTo.text.raw = "<no text>";
        }
    }
    next();
}
/**
 * Adds a `forward` object to the tediCross context, if the message is a forward
 *
 * @param ctx	The context to add the property to
 * @param ctx.tediCross	The tediCross on the context
 * @param ctx.tediCross.message	The message object to create the `forward` object from
 * @param next	Function to pass control to next middleware
 */
function addForwardFrom(ctx, next) {
    const msg = ctx.tediCross.message;
    if (!ramda_1.default.isNil(msg.forward_from) || !ramda_1.default.isNil(msg.forward_from_chat)) {
        ctx.tediCross.forwardFrom = ramda_1.default.ifElse(
        // If there is no `forward_from` prop
        ramda_1.default.compose(ramda_1.default.isNil, ramda_1.default.prop("forward_from")), 
        // Then this is a forward from a chat (channel)
        //@ts-ignore
        ramda_1.default.compose(From_1.createFromObjFromChat, ramda_1.default.prop("forward_from_chat")), 
        // Else it is from a user
        //@ts-ignore
        ramda_1.default.compose(From_1.createFromObjFromUser, ramda_1.default.prop("forward_from")))(msg);
    }
    next();
}
/**
 * Adds a text object to the tediCross property on the context, if there is text in the message
 *
 * @param ctx	The context to add the property to
 * @param ctx.tediCross	The tediCross on the context
 * @param ctx.tediCross.message	The message object to get the text data from
 * @param next	Function to pass control to next middleware
 */
function addTextObj(ctx, next) {
    const text = createTextObjFromMessage(ctx, ctx.tediCross.message);
    if (!ramda_1.default.isNil(text)) {
        ctx.tediCross.text = text;
    }
    next();
}
/**
 * Adds a file object to the tediCross property on the context
 *
 * @param ctx The context to add the property to
 * @param ctx.tediCross The tediCross on the context
 * @param ctx.tediCross.message The message object to get the file data from
 * @param next Function to pass control to next middleware
 */
function addFileObj(ctx, next) {
    const message = ctx.tediCross.message;
    // Figure out if a file is present
    if (!ramda_1.default.isNil(message.audio)) {
        // Audio
        ctx.tediCross.file = {
            type: "audio",
            id: message.audio.file_id,
            name: message.audio.title + "." + lite_1.default.getExtension(message.audio.mime_type)
        };
    }
    else if (!ramda_1.default.isNil(message.document)) {
        // Generic file
        ctx.tediCross.file = {
            type: "document",
            id: message.document.file_id,
            name: message.document.file_name
        };
    }
    else if (!ramda_1.default.isNil(message.photo)) {
        // Photo. It has an array of photos of different sizes. Use the last and biggest
        const photo = ramda_1.default.last(message.photo);
        ctx.tediCross.file = {
            type: "photo",
            id: photo.file_id,
            name: "photo.jpg" // Telegram will convert it to a jpg no matter which format is orignally sent
        };
    }
    else if (!ramda_1.default.isNil(message.sticker)) {
        // Sticker
        ctx.tediCross.file = {
            type: "sticker",
            id: ramda_1.default.ifElse(ramda_1.default.propEq("is_animated", true), ramda_1.default.path(["thumb", "file_id"]), ramda_1.default.prop("file_id"))(message.sticker),
            name: "sticker.webp"
        };
    }
    else if (!ramda_1.default.isNil(message.video)) {
        // Video
        ctx.tediCross.file = {
            type: "video",
            id: message.video.file_id,
            name: "video" + "." + lite_1.default.getExtension(message.video.mime_type)
        };
    }
    else if (!ramda_1.default.isNil(message.voice)) {
        // Voice
        ctx.tediCross.file = {
            type: "voice",
            id: message.voice.file_id,
            name: "voice" + "." + lite_1.default.getExtension(message.voice.mime_type)
        };
    }
    next();
}
/**
 * Adds a file link to the file object on the tedicross context, if there is one
 *
 * @param ctx The context to add the property to
 * @param ctx.tediCross The tediCross on the context
 * @param next Function to pass control to next middleware
 *
 * @returns Promise resolving to nothing when the operation is complete
 */
function addFileLink(ctx, next) {
    return Promise.resolve()
        .then(() => {
        // Get a stream to the file, if one was found
        if (!ramda_1.default.isNil(ctx.tediCross.file)) {
            return ctx.telegram.getFileLink(ctx.tediCross.file.id).then(fileLink => {
                ctx.tediCross.file.link = fileLink.href;
            });
        }
    })
        .then(next)
        .then(ramda_1.default.always(undefined))
        .catch(err => {
        if (err.response && err.response.description === "Bad Request: file is too big") {
            ctx.reply("<i>File is too big for TediCross to handle</i>", { parse_mode: "HTML" });
        }
    });
}
async function addPreparedObj(ctx, next) {
    // Shorthand for the tediCross context
    const tc = ctx.tediCross;
    ctx.tediCross.prepared = await Promise.all(ramda_1.default.map(async (bridge) => {
        // Get the name of the sender of this message
        const senderName = (0, From_1.makeDisplayName)(ctx.TediCross.settings.telegram.useFirstNameInsteadOfUsername, tc.from);
        // Make the header
        // WARNING! Butt-ugly code! If you see a nice way to clean this up, please do it
        const header = await (async () => {
            // Get the name of the original sender, if this is a forward
            const originalSender = ramda_1.default.isNil(tc.forwardFrom)
                ? null
                : (0, From_1.makeDisplayName)(ctx.TediCross.settings.telegram.useFirstNameInsteadOfUsername, tc.forwardFrom);
            // Get the name of the replied-to user, if this is a reply
            const repliedToName = ramda_1.default.isNil(tc.replyTo)
                ? null
                : await ramda_1.default.ifElse(ramda_1.default.prop("isReplyToTediCross"), ramda_1.default.compose((username) => makeDiscordMention(username, ctx.TediCross.dcBot, bridge), ramda_1.default.prop("dcUsername")), ramda_1.default.compose(ramda_1.default.partial(From_1.makeDisplayName, [
                    ctx.TediCross.settings.telegram.useFirstNameInsteadOfUsername
                ]), 
                //@ts-ignore
                ramda_1.default.prop("originalFrom")))(tc.replyTo);
            // Build the header
            let header = "";
            if (bridge.telegram.sendUsernames) {
                if (!ramda_1.default.isNil(tc.forwardFrom)) {
                    // Forward
                    header = `**${originalSender}** (forwarded by **${senderName}**)`;
                }
                else if (!ramda_1.default.isNil(tc.replyTo)) {
                    // Reply
                    header = `**${senderName}** (in reply to **${repliedToName}**)`;
                }
                else {
                    // Ordinary message
                    header = `**${senderName}**`;
                }
            }
            else {
                if (!ramda_1.default.isNil(tc.forwardFrom)) {
                    // Forward
                    header = `(forward from **${originalSender}**)`;
                }
                else if (!ramda_1.default.isNil(tc.replyTo)) {
                    // Reply
                    header = `(in reply to **${repliedToName}**)`;
                }
                else {
                    // Ordinary message
                    header = "";
                }
            }
            return header;
        })();
        // Handle blockquote replies
        const replyQuote = ramda_1.default.ifElse(tc => !ramda_1.default.isNil(tc.replyTo), 
        //@ts-ignore
        ramda_1.default.compose(ramda_1.default.replace(/^/gm, "> "), tc => makeReplyText(tc.replyTo, ctx.TediCross.settings.discord.replyLength, ctx.TediCross.settings.discord.maxReplyLines)), ramda_1.default.always(undefined))(tc);
        // Handle file
        const file = ramda_1.default.ifElse(ramda_1.default.compose(ramda_1.default.isNil, ramda_1.default.prop("file")), ramda_1.default.always(undefined), (tc) => new discord_js_1.default.MessageAttachment(tc.file.link, tc.file.name))(tc);
        // Make the text to send
        const text = await (async () => {
            let text = await (0, handleEntities_1.handleEntities)(tc.text.raw, tc.text.entities, ctx.TediCross.dcBot, bridge);
            if (!ramda_1.default.isNil(replyQuote)) {
                text = replyQuote + "\n" + text;
            }
            return text;
        })();
        return {
            bridge,
            header,
            senderName,
            file,
            text
        };
    })(tc.bridges));
    next();
}
/***************
 * Export them *
 ***************/
exports.default = {
    addTediCrossObj,
    addMessageObj,
    addMessageId,
    addBridgesToContext,
    removeD2TBridges,
    removeBridgesIgnoringCommands,
    removeBridgesIgnoringJoinMessages,
    removeBridgesIgnoringLeaveMessages,
    informThisIsPrivateBot,
    addFromObj,
    addReplyObj,
    addForwardFrom,
    addTextObj,
    addFileObj,
    addFileLink,
    addPreparedObj
};
//# sourceMappingURL=middlewares.js.map