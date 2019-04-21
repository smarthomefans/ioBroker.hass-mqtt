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
        this.stateOn = this.getConfigString("state_on") || "ON";
        this.stateOff = this.getConfigString("state_off") || "OFF";
        this.availabilityTopic = this.getConfigString("availability_topic");
        if (this.availabilityTopic !== "") {
            this.payloadAvailable = this.getConfigString("payload_available") || "online";
            this.payloadNotAvailable = this.getConfigString("payload_not_available") || "offline";
        }
    }
    getIobStates() {
        return {
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
                    type: "string",
                    desc: "Current state",
                    read: true,
                    write: false,
                },
                native: {
                    topic: this.stateTopic,
                },
            },
            command: {
                type: "state",
                common: {
                    role: "switch",
                    name: "state",
                    type: "boolean",
                    desc: "Switch state",
                    read: false,
                    write: true,
                },
                native: {
                    topic: this.commandTopic,
                },
            },
        };
    }
}
exports.HaSwitch = HaSwitch;
