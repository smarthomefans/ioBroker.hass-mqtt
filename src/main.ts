/*
 * Created with @iobroker/create-adapter v1.11.0
 */

// The adapter-core module gives you access to the core ioBroker functions
// you need to create an adapter
import * as utils from "@iobroker/adapter-core";
import {HassDevice} from "./lib/hassmqtt";

// Load your modules here, e.g.:
// import * as fs from "fs";

// Augment the adapter.config object with the actual types
// TODO: delete this in the next version
declare global {
    namespace ioBroker {
        interface AdapterConfig {
            // Define the shape of your options here (recommended)
            option1: boolean;
            option2: string;
            // Or use a catch-all approach
            [key: string]: any;
        }
    }
}

class HassMqtt extends utils.Adapter {

    constructor(options: Partial<ioBroker.AdapterOptions> = {}) {
        super({
            ...options,
            name: "hass-mqtt",
        });
        this.on("ready", this.onReady.bind(this));
        this.on("objectChange", this.onObjectChange.bind(this));
        this.on("stateChange", this.onStateChange.bind(this));
        // this.on("message", this.onMessage.bind(this));
        this.on("unload", this.onUnload.bind(this));
    }

    private mqttId2device: Record<string, HassDevice> = {};
    private stateId2device: Record<string, HassDevice> = {};

    /**
     * Is called when databases are connected and adapter received configuration.
     */
    private async onReady() {
        // Initialize your adapter here

        // Reset the connection indicator during startup
        this.setState("info.connection", false, true);
        if (this.config.mqttClientInstantID === "") {
            this.log.error("Must create and locate a mqtt client instant first.")
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
            } else {
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
    }

    /**
     * Is called when adapter shuts down - callback has to be called under any circumstances!
     */
    private onUnload(callback: () => void) {
        try {
            this.log.info("cleaned everything up...");
            callback();
        } catch (e) {
            callback();
        }
    }

    /**
     * Is called if a subscribed object changes
     */
    private onObjectChange(id: string, obj: ioBroker.Object | null | undefined) {
        if (obj) {
            // The object was changed
            this.log.info(`object ${id} changed: ${JSON.stringify(obj)}`);
        } else {
            // The object was deleted
            this.log.info(`object ${id} deleted`);
        }
    }

    private configReg = new RegExp(`(\w*\.)+config`);
    private isConfigMqttId(id: string) {
        return this.configReg.test(id);
    }

    /**
     * Is called if a subscribed state changes
     */
    private onStateChange(id: string, state: ioBroker.State | null | undefined) {
        if (state) {
            // The state was changed
            this.log.info(`state ${id} changed: ${state.val} (ack = ${state.ack})`);
            if (id.indexOf(`${this.config.mqttClientInstantID}`) === 0) {
                // MQTT topic change, need sync to adapter's state.
                id = id.substring(`${this.config.mqttClientInstantID}.`.length);
                if (id === `info.connection`) {
                    if (state.val) {
                        this.setState("info.connection", true, true);
                    } else {
                        this.setState("info.connection", false, true);
                    }
                } else if (id.indexOf(`${this.config.hassPrefix}`) === 0) {
                    this.handleHassMqttStates(id, state);
                } else if (this.mqttId2device[id]) {
                    this.handleCustomMqttStates(id, state);
                }
            } else if (id.indexOf(`${this.namespace}`) === 0) {
                // Adapter's state change, need send payload to MQTT topic.
                id = id.substring(`${this.namespace}.`.length);
                this.handleSelfStateChange(id, state);
            } else {
                this.log.warn(`Got unexpected id: ${id}`);
            }
        } else {
            // The state was deleted
            this.log.info(`state ${id} deleted`);
            if (id.indexOf(`${this.config.mqttClientInstantID}`) === 0) {
                id = id.substring(`${this.config.mqttClientInstantID}.`.length);
                if (id === `info.connection`) {
                    this.setState("info.connection", false, true);
                }
            } else {
                // self state change
            }
        }
    }

    private handleHassMqttAddDevice(id: string, s: ioBroker.State) {
        const dev = new HassDevice(id, s.val);

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
                                    } else if (state.native && state.native.customTopic) {
                                        const ct = `${state.native.customTopic.replace(/\//g, ".")}`;
                                        this.mqttId2device[ct] = dev;
                                        this.getForeignObject(`${this.config.mqttClientInstantID}.${ct}`, (_____, mqttobj) => {
                                            if (!mqttobj) {
                                                // MQTT topic never be received, Create object first.
                                                mqttobj = {
                                                    _id: `${this.config.mqttClientInstantID}.${ct}`,
                                                    common: {
                                                        name:  state.native.customTopic,
                                                        write: true,
                                                        read:  true,
                                                        role:  "variable",
                                                        desc:  "mqtt client variable",
                                                        type: "boolean",
                                                    },
                                                    native: {
                                                        topic: state.native.customTopic,
                                                    },
                                                    type: "state",
                                                };
                                                this.setForeignObject(`${this.config.mqttClientInstantID}.${ct}`, mqttobj, true);
                                            } else {
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
            } else {
                // TODO: handle this issue.
                this.log.warn(`${devID} already defined. Please handle it.`);
                return;
            }
        });
    }

    private handleHassMqttStates(id: string, state: ioBroker.State) {
        // handle hass mqtt
        if (this.isConfigMqttId(id)) {
            if (this.mqttId2device[id] === undefined) {
                this.handleHassMqttAddDevice(id, state);
            } else {
                // registered device change mqtt
            }
        } else if (this.mqttId2device[id]) {
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
        } else {
            this.log.warn(`Hass MQTT id (${id}) doesn't connect to device.`);
        }
    }

    private handleCustomMqttStates(id: string, state: ioBroker.State) {
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

    private handleSelfStateChange(id: string, state: ioBroker.State) {
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
                this.setState(id, {ack: true});
            });
        }
    }
    // /**
    //  * Some message was sent to this instance over message box. Used by email, pushover, text2speech, ...
    //  * Using this method requires "common.message" property to be set to true in io-package.json
    //  */
    // private onMessage(obj: ioBroker.Message) {
    // 	if (typeof obj === "object" && obj.message) {
    // 		if (obj.command === "send") {
    // 			// e.g. send email or pushover or whatever
    // 			this.log.info("send command");

    // 			// Send response in callback if required
    // 			if (obj.callback) this.sendTo(obj.from, obj.command, "Message received", obj.callback);
    // 		}
    // 	}
    // }

}

if (module.parent) {
    // Export the constructor in compact mode
    module.exports = (options: Partial<ioBroker.AdapterOptions> | undefined) => new HassMqtt(options);
} else {
    // otherwise start the instance directly
    (() => new HassMqtt())();
}
