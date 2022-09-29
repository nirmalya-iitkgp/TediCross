"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.relayOldMessages = void 0;
const ramda_1 = __importDefault(require("ramda"));
const fetchDiscordChannel_1 = require("../fetchDiscordChannel");
/*********************************
 * The relayOldMessages function *
 *********************************/
/**
 * Relays messages which have been sent in Discord since the bot was last shut down
 *
 * @param logger	The Logger instance to log messages to
 * @param dcBot	The discord bot to relay from
 * @param latestDiscordMessageIds	Map between the bridges and the last relayed message ID on them
 * @param bridgeMap	Map of the bridges to use
 *
 * @returns	Promise which resolves when all messages have been relayed
 */
async function relayOldMessages(logger, dcBot, latestDiscordMessageIds, bridgeMap) {
    // Wait for the bot to connect to the API
    //@ts-ignore
    await dcBot.ready;
    const sortAndRelay = ramda_1.default.pipe(
    // Sort them by sending time
    ramda_1.default.sortBy(ramda_1.default.prop("createdTimestamp")), 
    // Emit each message to let the bot logic handle them
    ramda_1.default.forEach((message) => dcBot.emit("message", message)));
    // Find the latest message IDs for all bridges
    return (Promise.all(bridgeMap.bridges
        .map(bridge => ({
        bridge,
        messageId: latestDiscordMessageIds.getLatest(bridge)
    }))
        // Get messages which have arrived on each bridge since the bot was last shut down
        .map(({ bridge, messageId }) => 
    // Get the bridge's discord channel
    (0, fetchDiscordChannel_1.fetchDiscordChannel)(dcBot, bridge)
        .then(channel => 
    // Check if the message exists. If it doesn't exist, and this is not checked, the following `fetch` will get every single message the channel has ever seen, spamming down Telegram
    channel.messages
        .fetch(messageId)
        // Fetch all messages after it
        .then(message => channel.messages.fetch({
        limit: 100,
        after: message.id
    }))
        .then(messages => sortAndRelay([...messages.values()])))
        .catch(err => {
        logger.error(`Could not fetch old messages for channel ${bridge.discord.channelId} in bridge ${bridge.name}: ${err.message}`);
    })))
        // Always resolve to nothing
        .finally(ramda_1.default.always(undefined)));
}
exports.relayOldMessages = relayOldMessages;
//# sourceMappingURL=relayOldMessages.js.map