"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.fetchDiscordChannel = void 0;
const ramda_1 = __importDefault(require("ramda"));
/**
 * Gets a Discord channel, and logs an error if it doesn't exist
 *
 * @returns	A Promise resolving to the channel, or rejecting if it could not be fetched for some reason
 */
exports.fetchDiscordChannel = ramda_1.default.curry((dcBot, bridge) => {
    // Get the channel's ID
    const channelId = bridge.discord.channelId;
    // Try to get the channel
    return dcBot.channels.fetch(channelId).catch((err) => {
        console.error(`Could not find Discord channel ${channelId} in bridge ${bridge.name}: ${err.message}`);
        throw err;
    });
});
//# sourceMappingURL=fetchDiscordChannel.js.map