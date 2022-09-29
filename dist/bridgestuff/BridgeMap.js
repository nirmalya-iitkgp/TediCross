"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BridgeMap = void 0;
const ramda_1 = __importDefault(require("ramda"));
/** Map between chat IDs and bridges */
class BridgeMap {
    /**
     * Creates a new bridge map
     *
     * @param bridges	The bridges to map
     */
    constructor(bridges) {
        /** List of all bridges */
        this.bridges = [...bridges];
        /** Map between Discord channel IDs and bridges */
        this._discordToBridge = new Map();
        /** Map between Telegram chat IDs and bridges */
        this._telegramToBridge = new Map();
        // Populate the maps and set
        bridges.forEach(bridge => {
            const d = this._discordToBridge.get(Number(bridge.discord.channelId)) || [];
            const t = this._telegramToBridge.get(bridge.telegram.chatId) || [];
            this._discordToBridge.set(Number(bridge.discord.channelId), [...d, bridge]);
            this._telegramToBridge.set(bridge.telegram.chatId, [...t, bridge]);
        });
    }
    /**
     * Gets a bridge from Telegram chat ID
     *
     * @param telegramChatId ID of the Telegram chat to get the bridge for
     *
     * @returns The bridges corresponding to the chat ID
     */
    fromTelegramChatId(telegramChatId) {
        return ramda_1.default.defaultTo([], this._telegramToBridge.get(telegramChatId));
    }
    /**
     * Gets a bridge from Discord channel ID
     *
     * @param discordChannelId ID of the Discord channel to get the bridge for
     *
     * @returns The bridges corresponding to the channel ID
     */
    fromDiscordChannelId(discordChannelId) {
        return ramda_1.default.defaultTo([], this._discordToBridge.get(discordChannelId));
    }
}
exports.BridgeMap = BridgeMap;
//# sourceMappingURL=BridgeMap.js.map