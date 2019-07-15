"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const domain_1 = require("./domain");
/**
 * Not supported config:
 *  icon
 *  optimistic
 *  qos
 *  retain
 *  value_template
 *  json_attributes_topic
 */
class HaSwitch extends domain_1.Domain {
    constructor(config) {
        super(config);
        this.name = this.getConfigString("name") || "MQTT Switch";
        this.commandTopic = this.getConfigString("command_topic");
        this.payloadOn = this.getConfigString("payload_on") || "ON";
        this.payloadOff = this.getConfigString("payload_off") || "OFF";
        this.stateTopic = this.getConfigString("state_topic");
        this.stateOn = this.getConfigString("state_on") || this.payloadOn || "ON";
        this.stateOff = this.getConfigString("state_off") || this.payloadOff || "OFF";
        this.availabilityTopic = this.getConfigString("availability_topic");
        if (this.availabilityTopic !== "") {
            this.payloadAvailable = this.getConfigString("payload_available") || "online";
            this.payloadNotAvailable = this.getConfigString("payload_not_available") || "offline";
        }
        this._iobStates = {
            name: {
                type: "state",
                common: {
                    role: "text",
                    name: "name",
                    type: "string",
                    desc: "Device Friendly Name",
                    read: true,
                    write: false,
                },
                native: {},
            },
            state: {
                type: "state",
                common: {
                    role: "info.status",
                    name: "state",
                    type: "boolean",
                    desc: "Current state",
                    read: true,
                    write: false,
                },
                native: {
                    customTopic: this.stateTopic,
                },
            },
            command: {
                type: "state",
                common: {
                    role: "switch",
                    name: "command",
                    type: "boolean",
                    desc: "Set switch state",
                    read: true,
                    write: true,
                },
                native: {
                    customTopic: {
                        w: this.commandTopic,
                        r: this.stateTopic,
                    },
                },
            },
        };
        this._mqttPayloadCatch = {
            state: "",
            command: {
                w: "",
                r: "",
            },
        };
    }
    /**
     * Update readable state mqtt payload catch.
     * callback will update ioBroker readable state value.
     * @param stateID readable state ID
     * @param mqttPayload new mqtt payload got from mqtt broker
     * @param callback return new ioBroker state value
     */
    mqttStateChange(stateID, mqttPayload, callback) {
        if (stateID === "command") {
            if ((mqttPayload === this.stateOn) || (mqttPayload === this.stateOff)) {
                if (typeof this._mqttPayloadCatch.command === "object") {
                    this._mqttPayloadCatch.command.r = mqttPayload;
                    callback(mqttPayload === this.stateOn);
                }
            }
        }
        else if (stateID === "state") {
            if ((mqttPayload === this.stateOn) || (mqttPayload === this.stateOff)) {
                if (typeof this._mqttPayloadCatch.state === "string") {
                    this._mqttPayloadCatch.state = mqttPayload;
                    callback(mqttPayload === this.stateOn);
                }
            }
        }
        return;
    }
    /**
     * ioBroker writeable state change, need send mqtt message to broker
     * @param stateID ioBroker state name
     * @param val new state value
     * @param callback return new mqtt payload, need send to broker
     */
    iobStateChange(stateID, val, callback) {
        if (stateID === "command") {
            if ((typeof val === "boolean") && (typeof this._mqttPayloadCatch.command === "object")) {
                if (val) {
                    this._mqttPayloadCatch.command.w = this.payloadOn;
                    callback(this.payloadOn);
                }
                else {
                    this._mqttPayloadCatch.command.w = this.payloadOff;
                    callback(this.payloadOff);
                }
            }
        }
    }
}
exports.HaSwitch = HaSwitch;
