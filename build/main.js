"use strict";
/*
 * Created with @iobroker/create-adapter v1.11.0
 */
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
// The adapter-core module gives you access to the core ioBroker functions
// you need to create an adapter
const utils = require("@iobroker/adapter-core");
class HassMqtt extends utils.Adapter {
    constructor(options = {}) {
        super(Object.assign({}, options, { name: "hass-mqtt" }));
        this.on("ready", this.onReady.bind(this));
        this.on("objectChange", this.onObjectChange.bind(this));
        this.on("stateChange", this.onStateChange.bind(this));
        // this.on("message", this.onMessage.bind(this));
        this.on("unload", this.onUnload.bind(this));
    }
    /**
     * Is called when databases are connected and adapter received configuration.
     */
    onReady() {
        return __awaiter(this, void 0, void 0, function* () {
            // Initialize your adapter here
            // Reset the connection indicator during startup
            this.setState("info.connection", false, true);
            if (this.config.mqttClientInstantID === "") {
                this.log.error("Must create and locate a mqtt client instant first.");
                return;
            }
            if (this.config.hassPrefix === "") {
                this.log.warn("Homeassistant mqtt prefix not set. Use default prefix.");
                this.config.hassPrefix = "homeassistant";
            }
            // The adapters config (in the instance object everything under the attribute "native") is accessible via
            // this.config:
            this.log.info("config option1: " + this.config.option1);
            this.log.info("config option2: " + this.config.option2);
            this.log.info("config mqtt client instant: " + this.config.mqttClientInstantID);
            this.log.info("config homeassistant prefix: " + this.config.hassPrefix);
            /*
            For every state in the system there has to be also an object of type state
            Here a simple template for a boolean variable named "testVariable"
            Because every adapter instance uses its own unique namespace variable names can't collide with other adapters variables
            */
            yield this.setObjectAsync("testVariable", {
                type: "state",
                common: {
                    name: "testVariable",
                    type: "boolean",
                    role: "indicator",
                    read: true,
                    write: true,
                },
                native: {},
            });
            // in this template all states changes inside the adapters namespace are subscribed
            this.subscribeStates("*");
            this.subscribeForeignStates(`${this.config.mqttClientInstantID}.${this.config.hassPrefix}.*`);
            this.subscribeForeignStates(`${this.config.mqttClientInstantID}.info.connection`);
            /*
            setState examples
            you will notice that each setState will cause the stateChange event to fire (because of above subscribeStates cmd)
            */
            // the variable testVariable is set to true as command (ack=false)
            yield this.setStateAsync("testVariable", true);
            // same thing, but the value is flagged "ack"
            // ack should be always set to true if the value is received from or acknowledged from the target system
            yield this.setStateAsync("testVariable", { val: true, ack: true });
            // same thing, but the state is deleted after 30s (getState will return null afterwards)
            yield this.setStateAsync("testVariable", { val: true, ack: true, expire: 30 });
            // examples for the checkPassword/checkGroup functions
            let result = yield this.checkPasswordAsync("admin", "iobroker");
            this.log.info("check user admin pw ioboker: " + result);
            result = yield this.checkGroupAsync("admin", "admin");
            this.log.info("check group user admin group admin: " + result);
            this.getForeignState(`${this.config.mqttClientInstantID}.info.connection`, (err, state) => {
                if (err) {
                    this.log.info(`Get mqtt connection failed. ${err}`);
                    return;
                }
                if (!state) {
                    this.log.info(`mqtt connection state is not exist, wait mqtt ready`);
                    return;
                }
                if (state.val) {
                    this.setState("info.connection", true, true);
                }
                else {
                    this.setState("info.connection", false, true);
                }
            });
        });
    }
    /**
     * Is called when adapter shuts down - callback has to be called under any circumstances!
     */
    onUnload(callback) {
        try {
            this.log.info("cleaned everything up...");
            callback();
        }
        catch (e) {
            callback();
        }
    }
    /**
     * Is called if a subscribed object changes
     */
    onObjectChange(id, obj) {
        if (obj) {
            // The object was changed
            this.log.info(`object ${id} changed: ${JSON.stringify(obj)}`);
        }
        else {
            // The object was deleted
            this.log.info(`object ${id} deleted`);
        }
    }
    /**
     * Is called if a subscribed state changes
     */
    onStateChange(id, state) {
        if (state) {
            // The state was changed
            this.log.info(`state ${id} changed: ${state.val} (ack = ${state.ack})`);
            if (id === `${this.config.mqttClientInstantID}.info.connection`) {
                if (state.val) {
                    this.setState("info.connection", true, true);
                }
                else {
                    this.setState("info.connection", false, true);
                }
            }
        }
        else {
            // The state was deleted
            this.log.info(`state ${id} deleted`);
        }
    }
}
if (module.parent) {
    // Export the constructor in compact mode
    module.exports = (options) => new HassMqtt(options);
}
else {
    // otherwise start the instance directly
    (() => new HassMqtt())();
}
