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
        this.mqttId2devices = {};
        this.wStateId2device = {};
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
            if (this.config.mqttClientInstanceID === "") {
                this.log.error("Must create and locate a mqtt client instant first.");
                return;
            }
            if (this.config.hassPrefix === "") {
                this.log.warn("Homeassistant mqtt prefix not set. Use default prefix.");
                this.config.hassPrefix = "homeassistant";
            }
            // The adapters config (in the instance object everything under the attribute "native") is accessible via
            // this.config:
            this.log.info("config mqtt client instant: " + this.config.mqttClientInstanceID);
            this.log.info("config homeassistant prefix: " + this.config.hassPrefix);
            // in this template all states changes inside the adapters namespace are subscribed
            this.subscribeStates("*");
            this.subscribeForeignStates(`${this.config.mqttClientInstanceID}.${this.config.hassPrefix}.*`);
            this.subscribeForeignStates(`${this.config.mqttClientInstanceID}.info.connection`);
            this.getForeignState(`${this.config.mqttClientInstanceID}.info.connection`, (err, state) => {
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
            this.getForeignStates(`${this.config.mqttClientInstanceID}.${this.config.hassPrefix}.*.config`, (err, states) => {
                if (err) {
                    this.log.info(`Mqtt client dose not exist homeassistant like topics.`);
                    return;
                }
                for (const s in states) {
                    if (states.hasOwnProperty(s)) {
                        const st = states[s];
                        if (st) {
                            this.log.debug(`Read state in ready. id=${s} state=${JSON.stringify(st)}`);
                            this.onStateChange(s, st);
                        }
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
            this.log.debug(`state ${id} changed: ${state.val} (ack = ${state.ack})`);
            if (id.indexOf(`${this.config.mqttClientInstanceID}`) === 0) {
                // MQTT topic change, need sync to adapter's state.
                id = id.substring(`${this.config.mqttClientInstanceID}.`.length);
                if (id === `info.connection`) {
                    if (state.val) {
                        this.setState("info.connection", true, true);
                    }
                    else {
                        this.setState("info.connection", false, true);
                    }
                }
                else if (this.isConfigMqttId(id)) {
                    this.handleHassMqttAddDevice(id, state);
                }
                else if (this.mqttId2devices[id]) {
                    this.handleCustomMqttStates(id, state);
                }
            }
            else if (id.indexOf(`${this.namespace}`) === 0) {
                // Adapter's state change, need send payload to MQTT topic.
                // TODO: only if before ack is false, ignore ack = true
                // Maybe can use from?
                // DEBUG:read state: {"val":"3.6","ack":true,"ts":1560678489301,"q":0,"from":"system.adapter.hass-mqtt.0","user":"system.user.admin","lc":1560678489301}
                this.log.debug(`DEBUG:read state: ${JSON.stringify(state)}`);
                if (state.ack)
                    return;
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
            if (id.indexOf(`${this.config.mqttClientInstanceID}`) === 0) {
                id = id.substring(`${this.config.mqttClientInstanceID}.`.length);
                if (id === `info.connection`) {
                    this.setState("info.connection", false, true);
                }
            }
            else {
                // self state change
            }
        }
    }
    _addDevSyncStateFromMqtt(dev, topic, sID, callback) {
        const topicID = topic.replace(/\//g, ".");
        this.getForeignObject(`${this.config.mqttClientInstanceID}.${topicID}`, (_, oObj) => {
            if (oObj) {
                // MQTT topic exist. Sync topic value
                this.getForeignState(`${this.config.mqttClientInstanceID}.${topicID}`, (_, mqttState) => {
                    if (!mqttState) {
                        this.log.info(`Custom topic(${topic}) not ready yet.`);
                        return;
                    }
                    this.log.debug(`Sync topic value for ${sID} topic: ${topicID} value: ${mqttState.val}`);
                    dev.mqttStateChange(topicID, mqttState.val, (err, iobState, iobVal) => {
                        if (err) {
                            if (err === "NO CHANGE") {
                                return;
                            }
                            this.log.error(`Set mqtt state change failed. ${err}`);
                            return;
                        }
                        if (dev.nodeID) {
                            this.setState(`${dev.nodeID}.${dev.iobChannel}_${dev.entityID}.${iobState}`, iobVal, true);
                        }
                        else {
                            this.setState(`${dev.entityID}.${dev.iobChannel}.${iobState}`, iobVal, true);
                        }
                    });
                });
            }
        });
        callback(topicID);
    }
    // TODO: fix state any.
    _addDevCreateState(dev, devID, channelID, stateID, state, callback) {
        this.getObject(`${devID}.${channelID}.${stateID}`, (_, oObj) => {
            if (!oObj) {
                // State not exist. Create state.
                this.createState(devID, channelID, stateID, state.common, state.native, (_, obj) => {
                    if (stateID === "name") {
                        this.setState(`${obj.id}`, dev.friendlyName, true);
                    }
                    else if (state.native && state.native.customTopic) {
                        if (typeof state.native.customTopic === "object") {
                            if (state.native.customTopic.w) {
                                this._addDevSyncStateFromMqtt(dev, state.native.customTopic.w, obj.id, (topicID) => {
                                    if (typeof this.mqttId2devices[topicID] === "undefined") {
                                        this.mqttId2devices[topicID] = [];
                                        this.mqttId2devices[topicID].push(dev);
                                        this.subscribeForeignStates(`${this.config.mqttClientInstanceID}.${topicID}`);
                                    }
                                    else {
                                        this.mqttId2devices[topicID].push(dev);
                                    }
                                });
                            }
                            if (state.native.customTopic.r) {
                                this._addDevSyncStateFromMqtt(dev, state.native.customTopic.r, obj.id, (topicID) => {
                                    if (typeof this.mqttId2devices[topicID] === "undefined") {
                                        this.mqttId2devices[topicID] = [];
                                        this.mqttId2devices[topicID].push(dev);
                                        this.subscribeForeignStates(`${this.config.mqttClientInstanceID}.${topicID}`);
                                    }
                                    else {
                                        this.mqttId2devices[topicID].push(dev);
                                    }
                                });
                            }
                        }
                        else {
                            this._addDevSyncStateFromMqtt(dev, state.native.customTopic, obj.id, (topicID) => {
                                if (typeof this.mqttId2devices[topicID] === "undefined") {
                                    this.mqttId2devices[topicID] = [];
                                    this.mqttId2devices[topicID].push(dev);
                                    this.subscribeForeignStates(`${this.config.mqttClientInstanceID}.${topicID}`);
                                }
                                else {
                                    this.mqttId2devices[topicID].push(dev);
                                }
                            });
                        }
                    }
                    if (state.common.write) {
                        callback();
                    }
                });
            }
            else {
                // State exist. Update state.
                this.extendObject(`${devID}.${channelID}.${stateID}`, state, (_, obj) => {
                    if (stateID === "name") {
                        this.setState(`${obj.id}`, dev.friendlyName, true);
                    }
                    else if (state.native && state.native.customTopic) {
                        if (typeof state.native.customTopic === "object") {
                            if (state.native.customTopic.w) {
                                this._addDevSyncStateFromMqtt(dev, state.native.customTopic.w, obj.id, (topicID) => {
                                    if (typeof this.mqttId2devices[topicID] === "undefined") {
                                        this.mqttId2devices[topicID] = [];
                                        this.mqttId2devices[topicID].push(dev);
                                        this.subscribeForeignStates(`${this.config.mqttClientInstanceID}.${topicID}`);
                                    }
                                    else {
                                        this.mqttId2devices[topicID].push(dev);
                                    }
                                });
                            }
                            if (state.native.customTopic.r) {
                                this._addDevSyncStateFromMqtt(dev, state.native.customTopic.r, obj.id, (topicID) => {
                                    if (typeof this.mqttId2devices[topicID] === "undefined") {
                                        this.mqttId2devices[topicID] = [];
                                        this.mqttId2devices[topicID].push(dev);
                                        this.subscribeForeignStates(`${this.config.mqttClientInstanceID}.${topicID}`);
                                    }
                                    else {
                                        this.mqttId2devices[topicID].push(dev);
                                    }
                                });
                            }
                        }
                        else {
                            this._addDevSyncStateFromMqtt(dev, state.native.customTopic, obj.id, (topicID) => {
                                if (typeof this.mqttId2devices[topicID] === "undefined") {
                                    this.mqttId2devices[topicID] = [];
                                    this.mqttId2devices[topicID].push(dev);
                                    this.subscribeForeignStates(`${this.config.mqttClientInstanceID}.${topicID}`);
                                }
                                else {
                                    this.mqttId2devices[topicID].push(dev);
                                }
                            });
                        }
                    }
                    if (state.common.write) {
                        callback();
                    }
                });
            }
        });
    }
    _addDevCreateChannel(dev, devID, channelID, callback) {
        this.getObject(`${devID}.${channelID}`, (_, oObj) => {
            if (!oObj) {
                // Channel not exist, Create channel.
                this.createChannel(devID, channelID, () => {
                    for (const sID in dev.iobStates) {
                        if (dev.iobStates.hasOwnProperty(sID)) {
                            const state = dev.iobStates[sID];
                            this._addDevCreateState(dev, devID, channelID, sID, state, () => {
                                this.wStateId2device[`${devID}.${channelID}.${sID}`] = dev;
                            });
                        }
                    }
                    if (callback) {
                        callback();
                    }
                });
            }
            else {
                // Channel exist. Update state if not exist.
                for (const sID in dev.iobStates) {
                    if (dev.iobStates.hasOwnProperty(sID)) {
                        const state = dev.iobStates[sID];
                        this._addDevCreateState(dev, devID, channelID, sID, state, () => {
                            this.wStateId2device[`${devID}.${channelID}.${sID}`] = dev;
                        });
                    }
                }
                if (callback) {
                    callback();
                }
            }
        });
    }
    _addDevCreateDev(dev, devID) {
        this.getObject(devID, (_, oObj) => {
            if (!oObj) {
                this.createDevice(devID, () => {
                    let cID = dev.iobChannel;
                    if (dev.nodeID) {
                        cID = `${cID}_${dev.entityID}`;
                    }
                    this._addDevCreateChannel(dev, devID, cID);
                });
            }
            else {
                let cID = dev.iobChannel;
                if (dev.nodeID) {
                    cID = `${cID}_${dev.entityID}`;
                }
                this._addDevCreateChannel(dev, devID, cID);
            }
        });
    }
    handleHassMqttAddDevice(id, s) {
        const dev = new hassmqtt_1.HassDevice(id, s.val);
        if (!dev.ready) {
            this.log.warn(`${id} not supported.`);
            return;
        }
        this._addDevCreateDev(dev, dev.nodeID || dev.entityID);
    }
    handleCustomMqttStates(mqttID, mqttState) {
        for (const dev of this.mqttId2devices[mqttID]) {
            if (typeof dev === "undefined") {
                this.log.warn(`MQTT id (${mqttID}) doesn't connect to device.`);
                return;
            }
            this.log.debug(`handle mqtt topic ${mqttID}`);
            dev.mqttStateChange(mqttID, mqttState.val, (err, iobState, iobVal) => {
                if (err) {
                    if (err === "NO CHANGE") {
                        return;
                    }
                    this.log.error(`Set mqtt state change failed. ${err}`);
                    return;
                }
                if (dev.nodeID) {
                    this.setState(`${dev.nodeID}.${dev.iobChannel}_${dev.entityID}.${iobState}`, iobVal, true);
                }
                else {
                    this.setState(`${dev.entityID}.${dev.iobChannel}.${iobState}`, iobVal, true);
                }
            });
        }
    }
    /**
     * Writeable state change.
     * @param id
     * @param state
     */
    handleSelfStateChange(id, state) {
        if (typeof this.wStateId2device[id] !== "undefined") {
            const dev = this.wStateId2device[id];
            dev.iobStateChange(id, state.val, (err, mqttTopic, mqttVal) => {
                if (err) {
                    if ((err === "NO CHANGE") || (err === "NO NEED")) {
                        return;
                    }
                    this.log.error(`Set ioBroker state change failed. ${err}`);
                    return;
                }
                this.sendTo(this.config.mqttClientInstanceID, "sendMessage2Client", { topic: mqttTopic, message: mqttVal });
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
