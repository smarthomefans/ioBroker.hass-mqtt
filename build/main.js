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
const hassmqtt_1 = require("./lib/hassmqtt");
class HassMqtt extends utils.Adapter {
    constructor(options = {}) {
        super(Object.assign({}, options, { name: "hass-mqtt" }));
        this.mqttId2device = {};
        this.stateId2device = {};
        this.configReg = new RegExp(`(\w*\.)+config`);
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
                for (let s in states) {
                    if (states.hasOwnProperty(s)) {
                        const st = states[s];
                        s = s.substring(`${this.config.mqttClientInstantID}.`.length);
                        this.log.debug(`Read state in ready. id=${s} state=${JSON.stringify(st)}`);
                        this.handleHassMqttStates(s, st);
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
    /**
     * Is called if a subscribed state changes
     */
    onStateChange(id, state) {
        if (state) {
            // The state was changed
            this.log.info(`state ${id} changed: ${state.val} (ack = ${state.ack})`);
            if (id.indexOf(`${this.config.mqttClientInstantID}`) === 0) {
                // MQTT topic change, need sync to adapter's state.
                id = id.substring(`${this.config.mqttClientInstantID}.`.length);
                if (id === `info.connection`) {
                    if (state.val) {
                        this.setState("info.connection", true, true);
                    }
                    else {
                        this.setState("info.connection", false, true);
                    }
                }
                else if (id.indexOf(`${this.config.hassPrefix}`) === 0) {
                    this.handleHassMqttStates(id, state);
                }
                else if (this.mqttId2device[id]) {
                    this.handleCustomMqttStates(id, state);
                }
            }
            else if (id.indexOf(`${this.namespace}`) === 0) {
                // Adapter's state change, need send payload to MQTT topic.
                id = id.substring(`${this.namespace}.`.length);
                this.handleSelfStateChange(id, state);
            }
            else {
                this.log.warn(`Got unexpected id: ${id}`);
            }
        }
        else {
            // The state was deleted
            this.log.info(`state ${id} deleted`);
            if (id.indexOf(`${this.config.mqttClientInstantID}`) === 0) {
                id = id.substring(`${this.config.mqttClientInstantID}.`.length);
                if (id === `info.connection`) {
                    this.setState("info.connection", false, true);
                }
            }
            else {
                // self state change
            }
        }
    }
    handleHassMqttAddDevice(id, s) {
        const dev = new hassmqtt_1.HassDevice(id, s.val);
        if (!dev.ready) {
            this.log.warn(`${id} not supported.`);
            return;
        }
        const devID = dev.nodeID || dev.entityID;
        this.getObject(devID, (_, obj) => {
            if (!obj) {
                this.createDevice(devID, (__, dobj) => {
                    const channelID = dev.iobChannel;
                    this.createChannel(devID, channelID, (___, cobj) => {
                        const states = dev.iobStates;
                        for (const sID in states) {
                            if (states.hasOwnProperty(sID)) {
                                const state = states[sID];
                                //this.log.info(`create state ${JSON.stringify(state)}, ${typeof state}`);
                                this.createState(devID, channelID, sID, state.common, state.native, (____, sobj) => {
                                    if (sID === "name") {
                                        this.setState(`${sobj.id}`, dev.friendlyName, true);
                                    }
                                    else if (state.native && state.native.customTopic) {
                                        const ct = `${state.native.customTopic.replace(/\//g, ".")}`;
                                        this.mqttId2device[ct] = dev;
                                        this.getForeignObject(`${this.config.mqttClientInstantID}.${ct}`, (_____, mqttobj) => {
                                            if (!mqttobj) {
                                                // MQTT topic never be received, Create object first.
                                                mqttobj = {
                                                    _id: `${this.config.mqttClientInstantID}.${ct}`,
                                                    common: {
                                                        name: state.native.customTopic,
                                                        write: true,
                                                        read: true,
                                                        role: "variable",
                                                        desc: "mqtt client variable",
                                                        type: "boolean",
                                                    },
                                                    native: {
                                                        topic: state.native.customTopic,
                                                    },
                                                    type: "state",
                                                };
                                                this.setForeignObject(`${this.config.mqttClientInstantID}.${ct}`, mqttobj, true);
                                            }
                                            else {
                                                this.getForeignState(`${this.config.mqttClientInstantID}.${ct}`, (______, cs) => {
                                                    if (!cs) {
                                                        this.log.info(`Custom topic(${ct}) not ready yet.`);
                                                        return;
                                                    }
                                                    dev.mqttStateChange(ct, cs.val, (err, iobState, iobVal) => {
                                                        if (err) {
                                                            if (err === "NO CHANGE") {
                                                                this.log.debug("MQTT state no change.");
                                                                return;
                                                            }
                                                            this.log.error(`Set mqtt state change failed. ${err}`);
                                                            return;
                                                        }
                                                        this.setState(`${sobj.id}`, iobVal, true);
                                                    });
                                                });
                                            }
                                        });
                                        this.subscribeForeignStates(`${this.config.mqttClientInstantID}.${ct}`);
                                    }
                                    this.stateId2device[`${sobj.id}`] = dev;
                                });
                            }
                        }
                        this.mqttId2device[id] = dev;
                    });
                });
            }
            else {
                // TODO: handle this issue.
                this.log.warn(`${devID} already defined. Please handle it.`);
                return;
            }
        });
    }
    handleHassMqttStates(id, state) {
        // handle hass mqtt
        if (this.isConfigMqttId(id)) {
            if (this.mqttId2device[id] === undefined) {
                this.handleHassMqttAddDevice(id, state);
            }
            else {
                // registered device change mqtt
            }
        }
        else if (this.mqttId2device[id]) {
            const dev = this.mqttId2device[id];
            dev.mqttStateChange(id, state.val, (err, iobState, iobVal) => {
                if (err) {
                    if (err === "NO CHANGE") {
                        return;
                    }
                    this.log.error(`Set mqtt state change failed. ${err}`);
                    return;
                }
                this.setState(`${dev.domain}.${dev.entityID}.${iobState}`, iobVal, true);
            });
        }
        else {
            this.log.warn(`Hass MQTT id (${id}) doesn't connect to device.`);
        }
    }
    handleCustomMqttStates(id, state) {
        const dev = this.mqttId2device[id];
        if (typeof dev === "undefined") {
            this.log.warn(`Custom MQTT id (${id}) doesn't connect to device.`);
            return;
        }
        this.log.debug(`handle custom mqtt topic ${id}`);
        dev.mqttStateChange(id, state.val, (err, iobState, iobVal) => {
            if (err) {
                if (err === "NO CHANGE") {
                    return;
                }
                this.log.error(`Set mqtt state change failed. ${err}`);
                return;
            }
            this.setState(`${dev.domain}.${dev.entityID}.${iobState}`, iobVal, true);
        });
    }
    handleSelfStateChange(id, state) {
        if (typeof this.stateId2device[id] !== "undefined") {
            const dev = this.stateId2device[id];
            dev.iobStateChange(id, state.val, (err, mqttID, mqttVal) => {
                if (err) {
                    if (err === "NO CHANGE") {
                        return;
                    }
                    this.log.error(`Set ioBroker state change failed. ${err}`);
                    return;
                }
                this.setForeignState(`${this.config.mqttClientInstantID}.${mqttID}`, mqttVal, false);
                this.setState(id, { ack: true });
            });
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
