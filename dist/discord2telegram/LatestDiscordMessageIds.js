"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LatestDiscordMessageIds = void 0;
const fs_1 = __importDefault(require("fs"));
const promisify = require("util").promisify;
/*************************************
 * The LatestDiscordMessageIds class *
 *************************************/
/**
 * Persistently keeps track of the ID of the latest Discord message per bridge
 */
class LatestDiscordMessageIds {
    /**
     * Creates a new instance which keeps track of messages and bridges
     *
     * @param logger	The Logger instance to log messages to
     * @param filepath	Path to the file to persistently store the map in
     */
    constructor(logger, filepath) {
        /** The Logger instance to log messages to */
        this._logger = logger;
        /** The path of the file this map is connected to */
        this._filepath = filepath;
        /** The actual map */
        this._map = {};
        try {
            // Check if the file exists. This throws if it doesn't
            fs_1.default.accessSync(this._filepath, fs_1.default.constants.F_OK);
        }
        catch (e) {
            // Nope, it doesn't. Create it
            fs_1.default.writeFileSync(this._filepath, JSON.stringify({}));
        }
        // Read the file
        let data = null;
        try {
            //TODO added encoding. Check if it still works
            data = fs_1.default.readFileSync(this._filepath, "utf8");
        }
        catch (err) {
            // Well, the file has been confirmed to exist, so there must be no read access
            this._logger.error(`Cannot read the file ${this._filepath}:`, err);
            data = JSON.stringify({});
        }
        try {
            // Read the contents as JSON
            this._map = JSON.parse(data);
        }
        catch (err) {
            // Invalid JSON
            this._logger.error(`Could not read or parse the file ${this._filepath}:`, err);
            this._map = {};
        }
        /** Promise which resolves when writing has finished. Meant to be chained with every write operation */
        this._finishedWriting = Promise.resolve();
        // Bind methods to avoid problems with `this`
        this.setLatest = this.setLatest.bind(this);
        this.getLatest = this.getLatest.bind(this);
    }
    /**
     * Tells the map the latest message for a bridge
     *
     * @param message The latest message from Discord on the bridge
     * @param bridge The bridge
     */
    setLatest(messageId, bridge) {
        // Update the bridge map
        this._map[bridge.name] = messageId;
        // Write it to file when previous writes have completed
        this._finishedWriting = this._finishedWriting
            .then(() => promisify(fs_1.default.writeFile)(this._filepath, JSON.stringify(this._map, null, "\t")))
            .catch(err => this._logger.error("Writing last Discord message ID to file failed!", err));
    }
    /**
     * Gets the latest message ID for a bridge, or `null` if none was found
     *
     * @param bridge The bridge to get the message ID from
     *
     * @returns ID of the latest Discord message that passed over the bridge
     */
    getLatest(bridge) {
        return this._map[bridge.name] === undefined ? null : this._map[bridge.name];
    }
}
exports.LatestDiscordMessageIds = LatestDiscordMessageIds;
//# sourceMappingURL=LatestDiscordMessageIds.js.map