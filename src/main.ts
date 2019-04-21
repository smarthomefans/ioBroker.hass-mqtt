/*
 * Created with @iobroker/create-adapter v1.11.0
 */

// The adapter-core module gives you access to the core ioBroker functions
// you need to create an adapter
import * as utils from "@iobroker/adapter-core";
import * as haMqtt from "./lib/hassmqtt";

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

    private mqttId2device: Record<string, haMqtt.hassDevice> = {}

    /**
     * Is called when databases are connected and adapter received configuration.
     */
    private async onReady() {
        // Initialize your adapter here

        // Reset the connection indicator during startup
        this.setState("info.connection", false, true);
        if (this.config.mqttClientInstantID === "") {
            this.log.error("Must create and locate a mqtt client instant first.")
            return
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
                return
            }
            if (!state) {
                this.log.info(`mqtt connection state is not exist, wait mqtt ready`);
                return
            }
            if (state.val) {
                this.setState("info.connection", true, true);
            } else {
                this.setState("info.connection", false, true);
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

    private stateReg = new RegExp(`(\w*\.)+state`);
    private isStateMqttId(id: string) {
        return this.stateReg.test(id);
    }

    /**
     * Is called if a subscribed state changes
     */
    private onStateChange(id: string, state: ioBroker.State | null | undefined) {
        if (state) {
            // The state was changed
            this.log.info(`state ${id} changed: ${state.val} (ack = ${state.ack})`);
            if (id === `${this.config.mqttClientInstantID}.info.connection`) {
                if (state.val) {
                    this.setState("info.connection", true, true);
                } else {
                    this.setState("info.connection", false, true);
                }
            } else if (id.indexOf(`${this.config.mqttClientInstantID}.${this.config.hassPrefix}`) === 0) {
                // handle hass mqtt
                id = id.substring(`${this.config.mqttClientInstantID}.${this.config.hassPrefix}.`.length);
                if (this.isConfigMqttId(id)) {
                    if (this.mqttId2device[id] === undefined) {
                        haMqtt.addDevice(id, state.val, (hassDev) => {
                            //TODO: init channel and states based on hassDev
                            const states = hassDev.instant.getIobStates();
                            if (typeof states === "undefined") {
                                this.log.warn(`${id} can not get ioBroker states.`);
                                return;
                            }
                            for (const state in states) {
                                this.setObject(`${this.config.hassPrefix}.${hassDev.domain}.${hassDev.entityID}.${state}`, states[state], true);
                            }
                            this.mqttId2device[id] = hassDev;
                        })
                    } else {
                        // registered device change mqtt
                    }
                } else if (this.isStateMqttId(id)) {
                    haMqtt.stateChange(id, state.val, (state) => {
                        //update iobroker state.
                    })
                } else {
                    // Attribute Mqtt Id
                    haMqtt.attributeChange(id, state.val, (attr) => {
                        //update iobroker state.
                    })
                }
            } else {
                // self state change
            }
        } else {
            // The state was deleted
            this.log.info(`state ${id} deleted`);
            if (id === `${this.config.mqttClientInstantID}.info.connection`) {
                this.setState("info.connection", false, true);
            } else if (id.indexOf(`${this.config.mqttClientInstantID}.${this.config.hassPrefix}`) === 0) {
                haMqtt.deleteDevice(id);
            } else {
                // self state change
            }
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