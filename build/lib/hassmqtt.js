"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const sensor_1 = require("./domain/sensor");
const switch_1 = require("./domain/switch");
const supportedDomain = {
    //    "alarm_control_panel",
    //    "binary_sensor": null,
    //    "camera",
    //    "cover": null,
    //    "fan",
    //    "climate",
    //    "light",
    //    "lock": null,
    sensor: sensor_1.HaSensor,
    switch: switch_1.HaSwitch,
};
class HassDevice {
    constructor(id, val) {
        this.domain = "";
        this.entityID = "";
        this.friendlyName = "";
        const match = id.split(".");
        try {
            JSON.parse(val);
        }
        catch (e) {
            return;
        }
        if (!match || match.length > 5) {
            return;
        }
        if (match.length === 5) {
            this.domain = match[1];
            this.nodeID = match[2];
            this.entityID = match[3];
            this.friendlyName = match[3];
        }
        else if (match.length === 4) {
            this.domain = match[1];
            this.entityID = match[2];
            this.friendlyName = match[2];
        }
        if (!supportedDomain[this.domain]) {
            // This domain not supported.
            return;
        }
        this._instant = new supportedDomain[this.domain](val);
        if (typeof this._instant === "undefined") {
            return;
        }
        if (this._instant.name) {
            this.friendlyName = this._instant.name;
        }
    }
    get iobStates() {
        if (typeof this._instant === "undefined") {
            return {};
        }
        return this._instant.iobStates;
    }
    get iobRole() {
        if (this.domain === "switch")
            return "switch";
        if (this.domain === "sensor")
            return "value";
        else
            return "";
    }
    get iobChannel() {
        if (this.domain === "switch")
            return "switch";
        if (this.domain === "sensor")
            return "value";
        else
            return "";
    }
    get ready() {
        return (typeof this._instant !== "undefined");
    }
    /**
     * Read mqtt message from broker. Update the ioBroker READABLE state
     * @param id MQTT Topic
     * @param val MQTT Topic Value
     * @param callback update object value
     */
    mqttStateChange(id, val, callback) {
        if (typeof this._instant === "undefined") {
            callback("Uninitialized device");
            return;
        }
        // One topic ID may mapped to multiple states
        const states = this._instant.idToReadableStates(id);
        for (const state of states) {
            const oldVal = this._instant.getReadableStateMqttPayload(state);
            if (val !== oldVal) {
                this._instant.mqttStateChange(state, val, (iobVal) => {
                    callback(null, state, iobVal);
                });
            }
            else {
                callback("NO CHANGE");
            }
        }
    }
    /**
     * Read ioBroker WRITEABLE state change message, Write to mqtt broker
     * @param id ioBroker state id
     * @param val ioBroker state value
     * @param callback send mqtt message
     */
    iobStateChange(id, val, callback) {
        if (typeof this._instant === "undefined") {
            callback("Uninitialized device");
            return;
        }
        const match = id.split(".");
        if (!match || match.length < 3) {
            callback(`Invalid ioBroker state ID: ${id}`);
            return;
        }
        const state = match[match.length - 1];
        const mqttTopic = this._instant.writeableStateToTopic(state);
        if (mqttTopic === "") {
            callback("NO NEED");
            return;
        }
        this._instant.iobStateChange(state, val, (mqttPayload) => {
            callback(null, mqttTopic, mqttPayload);
        });
    }
}
exports.HassDevice = HassDevice;
