"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// General stuff
const semver_1 = __importDefault(require("semver"));
const yargs_1 = __importDefault(require("yargs"));
const path_1 = __importDefault(require("path"));
const Logger_1 = require("./Logger");
const MessageMap_1 = require("./MessageMap");
const Bridge_1 = require("./bridgestuff/Bridge");
const BridgeMap_1 = require("./bridgestuff/BridgeMap");
const Settings_1 = require("./settings/Settings");
const js_yaml_1 = __importDefault(require("js-yaml"));
const fs_1 = __importDefault(require("fs"));
const ramda_1 = __importDefault(require("ramda"));
const os_1 = __importDefault(require("os"));
// Telegram stuff
const telegraf_1 = require("telegraf");
const setup_1 = require("./telegram2discord/setup");
// Discord stuff
const discord_js_1 = require("discord.js");
const setup_2 = require("./discord2telegram/setup");
if (!semver_1.default.gte(process.version, "16.0.0")) {
    console.log(`TediCross requires at least nodejs 16.0. Your version is ${process.version}`);
    process.exit();
}
/*************
 * TediCross *
 *************/
// Get command line arguments if any
const args = yargs_1.default
    .alias("v", "version")
    .alias("h", "help")
    .option("config", {
    alias: "c",
    default: path_1.default.join(__dirname, "..", "settings.yaml"),
    describe: "Specify path to settings file",
    type: "string"
})
    .option("data-dir", {
    alias: "d",
    default: path_1.default.join(__dirname, "..", "data"),
    describe: "Specify the path to the directory to store data in",
    type: "string"
}).argv;
// Get the settings
const settingsPath = args.config;
const rawSettingsObj = js_yaml_1.default.load(fs_1.default.readFileSync(settingsPath, "utf-8"));
const settings = Settings_1.Settings.fromObj(rawSettingsObj);
// Initialize logger
const logger = new Logger_1.Logger(settings.debug);
// Write the settings back to the settings file if they have been modified
const newRawSettingsObj = settings.toObj();
if (ramda_1.default.not(ramda_1.default.equals(rawSettingsObj, newRawSettingsObj))) {
    // Turn it into notepad friendly YAML
    //TODO: Replaced safeDump with dump. It needs to be verified
    const yaml = js_yaml_1.default.dump(newRawSettingsObj).replace(/\n/g, "\r\n");
    try {
        fs_1.default.writeFileSync(settingsPath, yaml);
    }
    catch (err) {
        if (err.code === "EACCES") {
            // The settings file is not writable. Give a warning
            logger.warn("Changes to TediCross' settings have been introduced. Your settings file it not writable, so it could not be automatically updated. TediCross will still work, with the modified settings, but you will see this warning until you update your settings file");
            // Write the settings to temp instead
            const tmpPath = path_1.default.join(os_1.default.tmpdir(), "tedicross-settings.yaml");
            try {
                fs_1.default.writeFileSync(tmpPath, yaml);
                logger.info(`The new settings file has instead been written to '${tmpPath}'. Copy it to its proper location to get rid of the warning`);
            }
            catch (err) {
                logger.warn(`An attempt was made to put the modified settings file at '${tmpPath}', but it could not be done. See the following error message`);
                logger.warn(err);
            }
        }
    }
}
// Create a Telegram bot
const tgBot = new telegraf_1.Telegraf(settings.telegram.token);
// Create a Discord bot
const dcBot = new discord_js_1.Client({ intents: [discord_js_1.Intents.FLAGS.GUILDS, discord_js_1.Intents.FLAGS.GUILD_MESSAGES] });
// Create a message ID map
const messageMap = new MessageMap_1.MessageMap();
// Create the bridge map
const bridgeMap = new BridgeMap_1.BridgeMap(settings.bridges.map((bridgeSettings) => new Bridge_1.Bridge(bridgeSettings)));
/*********************
 * Set up the bridge *
 *********************/
(0, setup_2.setup)(logger, dcBot, tgBot, messageMap, bridgeMap, settings, args.dataDir);
(0, setup_1.setup)(logger, tgBot, dcBot, messageMap, bridgeMap, settings);
//# sourceMappingURL=main.js.map