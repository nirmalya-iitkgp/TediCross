"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Logger = void 0;
const ramda_1 = __importDefault(require("ramda"));
const moment_1 = __importDefault(require("moment"));
const dummy = ramda_1.default.always(undefined);
/** Logger utility which works just like the ordinary 'console' but prefixes any message with a timestamp and type of message */
// eslint-disable-next-line no-console
class Logger extends console.Console {
    /**
     * Creates a new logger
     *
     * @param debug Whether to print debug messages
     */
    constructor(debug) {
        super(process.stdout, process.stderr);
        this._debugEnabled = debug;
        // Wrap the output methods
        this.log = this._wrapper(this.log, "LOG");
        this.info = this._wrapper(this.info, "INFO");
        this.error = this._wrapper(this.error, "ERR");
        this.warn = this._wrapper(this.warn, "WARN");
        this.debug = this._debugEnabled ? this._wrapper(this.debug, "DEBUG") : dummy;
    }
    /**
     * Wraps the console print methods so they print a bit more info
     *
     * @param method	The console method to wrap
     * @param tag	Tag to prefix all calls to this method with
     *
     * @returns A function which works just like the given method, but also prints extra data
     */
    _wrapper(method, tag) {
        return (...args) => {
            // Create the stamp
            const stamp = `${Logger.timestamp} [${tag}]`;
            // Put the stamp as the first argument, preserving the inspection of whatever the first argument is
            return method(stamp, ...args);
        };
    }
    /** The current timestamp on string format */
    static get timestamp() {
        return (0, moment_1.default)().format("YYYY-MM-DD HH:mm:ss");
    }
}
exports.Logger = Logger;
//# sourceMappingURL=Logger.js.map