"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
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
    //    "sensor": null,
    switch: switch_1.HaSwitch,
};
class HassDevice {
    constructor(id, val) {
        this.domain = "";
        this.entityID = "";
        this.friendlyName = "";
        this._instant = undefined;
        const match = id.split(".");
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
        if (this._instant.name) {
            this.friendlyName = this._instant.name;
        }
    }
    get iobStates() {
        return this._instant.getIobStates();
    }
    get ready() {
        return (typeof this._instant !== "undefined");
    }
    /**
     *
     * @param id MQTT Topic
     * @param val MQTT Topic Value
     * @param callback update object value
     */
    mqttStateChange(id, val, callback) {
        const state = this._instant.idToState(id);
        if (typeof state === "undefined") {
            callback(`Can not find state matched this ID ${id}`);
        }
        this._instant.mqttStateChange(state, val);
        callback(null, state, this._instant.iobStateVal(state));
    }
}
exports.HassDevice = HassDevice;
