"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.setup = void 0;
const md2html_1 = require("./md2html");
const MessageMap_1 = require("../MessageMap");
const LatestDiscordMessageIds_1 = require("./LatestDiscordMessageIds");
const handleEmbed_1 = require("./handleEmbed");
const relayOldMessages_1 = require("./relayOldMessages");
const Bridge_1 = require("../bridgestuff/Bridge");
const path_1 = __importDefault(require("path"));
const ramda_1 = __importDefault(require("ramda"));
const sleep_1 = require("../sleep");
const fetchDiscordChannel_1 = require("../fetchDiscordChannel");
const helpers_1 = require("./helpers");
/***********
 * Helpers *
 ***********/
/**
 * Creates a function to give to 'guildMemberAdd' or 'guildMemberRemove' on a Discord bot
 *
 * @param logger The Logger instance to log messages to
 * @param verb Either "joined" or "left"
 * @param bridgeMap Map of existing bridges
 * @param tgBot The Telegram bot to send the messages to
 *
 * @returns Function which can be given to the 'guildMemberAdd' or 'guildMemberRemove' events of a Discord bot
 *
 * @private
 */
function makeJoinLeaveFunc(logger, verb, bridgeMap, tgBot) {
    // Find out which setting property to check the bridges for
    const relaySetting = verb === "joined" ? "relayJoinMessages" : "relayLeaveMessages";
    return function (member) {
        // Get the bridges in the guild the member joined/left
        member.guild.channels.cache
            // Get the bridges corresponding to the channels in this guild
            .map(({ id }) => bridgeMap.fromDiscordChannelId(id))
            // Remove the ones which are not bridged
            .filter((bridges) => bridges !== undefined)
            // Flatten the bridge arrays
            .reduce((flattened, bridges) => flattened.concat(bridges))
            // Remove those which do not allow relaying join messages
            .filter((bridge) => bridge.discord[relaySetting])
            // Ignore the T2D bridges
            .filter((bridge) => bridge.direction !== Bridge_1.Bridge.DIRECTION_TELEGRAM_TO_DISCORD)
            .forEach(async (bridge) => {
            // Make the text to send
            const text = `<b>${member.displayName} (@${member.user.username})</b> ${verb} the Discord side of the chat`;
            try {
                // Send it
                await tgBot.telegram.sendMessage(bridge.telegram.chatId, text, {
                    parse_mode: "HTML"
                });
            }
            catch (err) {
                logger.error(`[${bridge.name}] Could not notify Telegram about a user that ${verb} Discord`, err);
            }
        });
    };
}
/**********************
 * The setup function *
 **********************/
/**
 * Sets up the receiving of Discord messages, and relaying them to Telegram
 *
 * @param logger The Logger instance to log messages to
 * @param dcBot The Discord bot
 * @param tgBot The Telegram bot
 * @param messageMap Map between IDs of messages
 * @param bridgeMap Map of the bridges to use
 * @param settings Settings to use
 * @param datadirPath Path to the directory to put data files in
 */
function setup(logger, dcBot, tgBot, messageMap, bridgeMap, settings, datadirPath) {
    // Create the map of latest message IDs and bridges
    const latestDiscordMessageIds = new LatestDiscordMessageIds_1.LatestDiscordMessageIds(logger, path_1.default.join(datadirPath, "latestDiscordMessageIds.json"));
    const useNickname = settings.discord.useNickname;
    // Make a set to keep track of where the "This is an instance of TediCross..." message has been sent the last minute
    const antiInfoSpamSet = new Set();
    // Set of server IDs. Will be filled when the bot is ready
    const knownServerIds = new Set();
    // Listen for users joining the server
    dcBot.on("guildMemberAdd", makeJoinLeaveFunc(logger, "joined", bridgeMap, tgBot));
    // Listen for users joining the server
    dcBot.on("guildMemberRemove", makeJoinLeaveFunc(logger, "left", bridgeMap, tgBot));
    // Listen for Discord messages
    dcBot.on("messageCreate", async (message) => {
        // Ignore the bot's own messages
        if (message.author.id === dcBot.user?.id) {
            return;
        }
        // Check if this is a request for server info
        if (message.cleanContent === "/chatinfo") {
            // It is. Give it
            message
                .reply("\nchannelId: '" + message.channel.id + "'")
                .then(sleep_1.sleepOneMinute)
                .then((info) => Promise.all([info.delete(), message.delete()]))
                .catch(helpers_1.ignoreAlreadyDeletedError);
            // Don't process the message any further
            return;
        }
        // Get info about the sender
        const senderName = ramda_1.default.compose(
        // Make it HTML safe
        helpers_1.escapeHTMLSpecialChars, 
        // Add a colon if wanted
        //@ts-ignore
        ramda_1.default.when(ramda_1.default.always(settings.telegram.colonAfterSenderName), senderName => senderName + ":"), 
        // Figure out what name to use
        ramda_1.default.ifElse(message => useNickname && !ramda_1.default.isNil(message.member), ramda_1.default.path(["member", "displayName"]), ramda_1.default.path(["author", "username"])))(message);
        // Check if the message is from the correct chat
        const bridges = bridgeMap.fromDiscordChannelId(Number(message.channel.id));
        if (!ramda_1.default.isEmpty(bridges)) {
            bridges.forEach(async (bridge) => {
                // Ignore it if this is a telegram-to-discord bridge
                if (bridge.direction === Bridge_1.Bridge.DIRECTION_TELEGRAM_TO_DISCORD) {
                    return;
                }
                // This is now the latest message for this bridge
                latestDiscordMessageIds.setLatest(message.id, bridge);
                // Check for attachments and pass them on
                message.attachments.forEach(async ({ url }) => {
                    try {
                        const textToSend = bridge.discord.sendUsernames
                            ? `<b>${senderName}</b>\n<a href="${url}">${url}</a>`
                            : `<a href="${url}">${url}</a>`;
                        const tgMessage = await tgBot.telegram.sendMessage(bridge.telegram.chatId, textToSend, {
                            parse_mode: "HTML"
                        });
                        messageMap.insert(MessageMap_1.MessageMap.DISCORD_TO_TELEGRAM, bridge, message.id, tgMessage.message_id.toString());
                    }
                    catch (err) {
                        logger.error(`[${bridge.name}] Telegram did not accept an attachment:`, err);
                    }
                });
                // Check the message for embeds
                message.embeds.forEach(embed => {
                    // Ignore it if it is not a "rich" embed (image, link, video, ...)
                    if (embed.type !== "rich") {
                        return;
                    }
                    // Convert it to something Telegram likes
                    const text = (0, handleEmbed_1.handleEmbed)(embed, senderName);
                    try {
                        // Send it
                        tgBot.telegram.sendMessage(bridge.telegram.chatId, text, {
                            parse_mode: "HTML",
                            disable_web_page_preview: true
                        });
                    }
                    catch (err) {
                        logger.error(`[${bridge.name}] Telegram did not accept an embed:`, err);
                    }
                });
                // Check if there is an ordinary text message
                if (message.cleanContent) {
                    // Modify the message to fit Telegram
                    const processedMessage = (0, md2html_1.md2html)(message.cleanContent);
                    // Pass the message on to Telegram
                    try {
                        const textToSend = bridge.discord.sendUsernames
                            ? `<b>${senderName}</b>\n${processedMessage}`
                            : processedMessage;
                        const tgMessage = await tgBot.telegram.sendMessage(bridge.telegram.chatId, textToSend, {
                            parse_mode: "HTML"
                        });
                        // Make the mapping so future edits can work
                        messageMap.insert(MessageMap_1.MessageMap.DISCORD_TO_TELEGRAM, bridge, message.id, tgMessage.message_id.toString());
                    }
                    catch (err) {
                        logger.error(`[${bridge.name}] Telegram did not accept a message:`, err);
                        logger.error(`[${bridge.name}] Failed message:`, err);
                    }
                }
            });
        }
        else if (ramda_1.default.isNil(message.channel.guild) ||
            !knownServerIds.has(message.channel.guild.id)) {
            // Check if it is the correct server
            // The message is from the wrong chat. Inform the sender that this is a private bot, if they have not been informed the last minute
            if (!antiInfoSpamSet.has(message.channel.id)) {
                antiInfoSpamSet.add(message.channel.id);
                message
                    .reply("This is an instance of a TediCross bot, bridging a chat in Telegram with one in Discord. " +
                    "If you wish to use TediCross yourself, please download and create an instance. " +
                    "See https://github.com/TediCross/TediCross")
                    // Delete it again after some time
                    .then(sleep_1.sleepOneMinute)
                    .then((message) => message.delete())
                    .catch(helpers_1.ignoreAlreadyDeletedError)
                    .then(() => antiInfoSpamSet.delete(message.channel.id));
            }
        }
    });
    // Listen for message edits
    dcBot.on("messageUpdate", async (_oldMessage, newMessage) => {
        // Don't do anything with the bot's own messages
        if (newMessage.author?.id === dcBot.user?.id) {
            return;
        }
        // Pass it on to the bridges
        bridgeMap.fromDiscordChannelId(Number(newMessage.channel.id)).forEach(async (bridge) => {
            try {
                // Get the corresponding Telegram message ID
                const [tgMessageId] = messageMap.getCorresponding(MessageMap_1.MessageMap.DISCORD_TO_TELEGRAM, bridge, newMessage.id);
                // Get info about the sender
                const senderName = (useNickname && newMessage.member ? newMessage.member.displayName : newMessage.author?.username) +
                    (settings.telegram.colonAfterSenderName ? ":" : "");
                // Modify the message to fit Telegram
                const processedMessage = (0, md2html_1.md2html)(newMessage.cleanContent || "");
                // Send the update to Telegram
                const textToSend = bridge.discord.sendUsernames
                    ? `<b>${senderName}</b>\n${processedMessage}`
                    : processedMessage;
                await tgBot.telegram.editMessageText(bridge.telegram.chatId, tgMessageId, undefined, textToSend, {
                    parse_mode: "HTML"
                });
            }
            catch (err) {
                logger.error(`[${bridge.name}] Could not edit Telegram message:`, err);
            }
        });
    });
    // Listen for deleted messages
    function onMessageDelete(message) {
        // Check if it is a relayed message
        const isFromTelegram = message.author.id === dcBot.user?.id;
        // Hand it on to the bridges
        bridgeMap.fromDiscordChannelId(Number(message.channel.id)).forEach(async (bridge) => {
            // Ignore it if cross deletion is disabled
            if (!bridge.discord.crossDeleteOnTelegram) {
                return;
            }
            try {
                // Get the corresponding Telegram message IDs
                const tgMessageIds = (isFromTelegram
                    ? messageMap.getCorrespondingReverse(MessageMap_1.MessageMap.DISCORD_TO_TELEGRAM, bridge, message.id)
                    : messageMap.getCorresponding(MessageMap_1.MessageMap.DISCORD_TO_TELEGRAM, bridge, message.id));
                // Try to delete them
                await Promise.all(tgMessageIds.map(tgMessageId => tgBot.telegram.deleteMessage(bridge.telegram.chatId, tgMessageId)));
            }
            catch (err) {
                logger.error(`[${bridge.name}] Could not delete Telegram message:`, err);
                logger.warn('If the previous message was a result of a message being "deleted" on Telegram, you can safely ignore it');
            }
        });
    }
    dcBot.on("messageDelete", onMessageDelete);
    dcBot.on("messageDeleteBulk", messages => [...messages.values()].forEach(onMessageDelete));
    // Start the Discord bot
    dcBot
        .login(settings.discord.token)
        // Complain if it could not authenticate for some reason
        .catch(err => logger.error("Could not authenticate the Discord bot:", err));
    // Listen for the 'disconnected' event
    dcBot.on("disconnected", async (evt) => {
        logger.error("Discord bot disconnected!", evt);
        bridgeMap.bridges.forEach(async (bridge) => {
            try {
                await tgBot.telegram.sendMessage(bridge.telegram.chatId, "**TEDICROSS**\nThe discord side of the bot disconnected! Please check the log");
            }
            catch (err) {
                logger.error(`[${bridge.name}] Could not send message to Telegram:`, err);
            }
        });
    });
    // Listen for errors
    dcBot.on("error", (err) => {
        //@ts-ignore
        if (err.code === "ECONNRESET") {
            // Lost connection to the discord servers
            logger.warn("Lost connection to Discord's servers. The bot will resume when connection is reestablished, which should happen automatically. If it does not, please report this to the TediCross support channel");
        }
        else {
            // Unknown error. Tell the user to tell the devs
            logger.error("The Discord bot ran into an error. Please post the following error message in the TediCross support channel");
            logger.error(err);
        }
    });
    // Listen for debug messages
    if (settings.debug) {
        dcBot.on("debug", str => {
            logger.log(str);
        });
    }
    // Make a promise which resolves when the dcBot is ready
    //@ts-ignore
    dcBot.ready = new Promise(resolve => {
        // Listen for the 'ready' event
        dcBot.once("ready", () => {
            // Log the event
            logger.info(`Discord: ${dcBot.user?.username} (${dcBot.user?.id})`);
            // Get the server IDs from the channels
            ramda_1.default.compose(
            // Mark the bot as ready
            ramda_1.default.andThen(() => resolve()), 
            // Add them to the known server ID set
            //@ts-ignore
            ramda_1.default.andThen(ramda_1.default.reduce((knownServerIds, serverId) => knownServerIds.add(serverId), knownServerIds)), 
            // Remove the invalid channels
            ramda_1.default.andThen(ramda_1.default.filter(ramda_1.default.complement(ramda_1.default.isNil))), 
            // Extract the server IDs from the channels
            ramda_1.default.andThen(ramda_1.default.map(ramda_1.default.path(["value", "guild", "id"]))), 
            // Remove those which failed
            ramda_1.default.andThen(ramda_1.default.filter(ramda_1.default.propEq("status", "fulfilled"))), 
            // Wait for the channels to be fetched
            Promise.allSettled.bind(Promise), 
            // Get the channels
            ramda_1.default.map(bridge => (0, fetchDiscordChannel_1.fetchDiscordChannel)(dcBot, bridge)), 
            // Get the bridges
            ramda_1.default.prop("bridges"))(bridgeMap);
        });
    });
    // Relay old messages, if wanted by the user
    if (!settings.discord.skipOldMessages) {
        //@ts-ignore
        dcBot.ready = (0, relayOldMessages_1.relayOldMessages)(logger, dcBot, latestDiscordMessageIds, bridgeMap);
    }
}
exports.setup = setup;
//# sourceMappingURL=setup.js.map