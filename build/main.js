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
const haMqtt = require("./lib/hassmqtt");
class HassMqtt extends utils.Adapter {
    constructor(options = {}) {
        super(Object.assign({}, options, { name: "hass-mqtt" }));
        this.mqttId2device = {};
        this.configReg = new RegExp(`(\w*\.)+config`);
        this.stateReg = new RegExp(`(\w*\.)+state`);
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
            this.log.info("config mqtt client instant: " + this.config.mqttClientInstantID);
            this.log.info("config homeassistant prefix: " + this.config.hassPrefix);
            // in this template all states changes inside the adapters namespace are subscribed
            this.subscribeStates("*");
            this.subscribeForeignStates(`${this.config.mqttClientInstantID}.${this.config.hassPrefix}.*`);
            this.subscribeForeignStates(`${this.config.mqttClientInstantID}.info.connection`);
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
            this.getForeignStates(`${this.config.mqttClientInstantID}.${this.config.hassPrefix}.*`, (err, states) => {
                if (err) {
                    this.log.info(`Mqtt client dose not exist homeassistant like topics.`);
                    return;
                }
                for (const s in states) {
                    if (states.hasOwnProperty(s)) {
                        this.log.debug(`Read state in ready. id=${s}`);
                        this.handleHassMqttStates(s, states[s]);
                    }
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
    isConfigMqttId(id) {
        return this.configReg.test(id);
    }
    isStateMqttId(id) {
        return this.stateReg.test(id);
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
            else if (id.indexOf(`${this.config.mqttClientInstantID}.${this.config.hassPrefix}`) === 0) {
                this.handleHassMqttStates(id, state);
            }
            else if (this.mqttId2device[id]) {
                this.handleCustomMqttStates(id, state);
            }
            else {
                // self state change
            }
        }
        else {
            // The state was deleted
            this.log.info(`state ${id} deleted`);
            if (id === `${this.config.mqttClientInstantID}.info.connection`) {
                this.setState("info.connection", false, true);
            }
            else if (id.indexOf(`${this.config.mqttClientInstantID}.${this.config.hassPrefix}`) === 0) {
                haMqtt.deleteDevice(id);
            }
            else {
                // self state change
            }
        }
    }
    handleHassMqttStates(id, state) {
        // handle hass mqtt
        if (id.indexOf(`${this.config.mqttClientInstantID}.${this.config.hassPrefix}`) === 0) {
            id = id.substring(`${this.config.mqttClientInstantID}.${this.config.hassPrefix}.`.length);
        }
        if (this.isConfigMqttId(id)) {
            if (this.mqttId2device[id] === undefined) {
                haMqtt.addDevice(id, state.val, (hassDev) => {
                    // TODO: init channel and states based on hassDev
                    const states = hassDev.instant.getIobStates();
                    if (typeof states === "undefined") {
                        this.log.warn(`${id} can not get ioBroker states.`);
                        return;
                    }
                    for (const s in states) {
                        if (states.hasOwnProperty(s)) {
                            this.setObject(`${this.config.hassPrefix}.${hassDev.domain}.${hassDev.entityID}.${s}`, states[s], true);
                            if (states[s].native && states[s].native.topic) {
                                const ct = `${this.config.mqttClientInstantID}.${states[s].native.topic.replace(/\//g, ".")}`;
                                this.mqttId2device[ct] = hassDev;
                                this.subscribeForeignStates(ct);
                                this.getForeignState(ct, (err, cs) => {
                                    if (err) {
                                        this.log.info(`Read Custom topic(${ct}) failed: ${err}.`);
                                        return;
                                    }
                                    if (!cs) {
                                        this.log.info(`Custom topic(${ct}) not ready yet.`);
                                        return;
                                    }
                                    this.handleCustomMqttStates(ct, cs);
                                });
                            }
                        }
                    }
                    this.setState(`${this.config.hassPrefix}.${hassDev.domain}.${hassDev.entityID}.name`, hassDev.friendlyName, true);
                    this.mqttId2device[id] = hassDev;
                });
            }
            else {
                // registered device change mqtt
            }
        }
        else if (this.isStateMqttId(id)) {
            haMqtt.stateChange(id, state.val, (state) => {
                // update iobroker state.
            });
        }
        else {
            // Attribute Mqtt Id
            haMqtt.attributeChange(id, state.val, (attr) => {
                // update iobroker state.
            });
        }
    }
    handleCustomMqttStates(id, state) {
        const hassDev = this.mqttId2device[id];
        if (typeof hassDev === "undefined") {
            this.log.warn(`Custom MQTT id (${id}) doesn't connect to device.`);
            return;
        }
        if (id.indexOf(`${this.config.mqttClientInstantID}`) === 0) {
            id = id.substring(`${this.config.mqttClientInstantID}.`.length);
        }
        this.log.debug(`handle custom mqtt topic ${id}`);
        hassDev.instant.stateChange(id, state.val);
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
