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
        this.commandTopicValue = this.payloadOff;
        this.stateTopic = this.getConfigString("state_topic");
        this.stateOn = this.getConfigString("state_on") || "ON";
        this.stateOff = this.getConfigString("state_off") || "OFF";
        this.stateTopicValue = this.stateOff;
        this.availabilityTopic = this.getConfigString("availability_topic");
        if (this.availabilityTopic !== "") {
            this.payloadAvailable = this.getConfigString("payload_available") || "online";
            this.payloadNotAvailable = this.getConfigString("payload_not_available") || "offline";
            this.availabilityTopicValue = this.payloadAvailable;
        }
        this.iobStates = {
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
                    customTopic: this.stateTopic,
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
                    customTopic: this.commandTopic,
                },
            },
        };
    }
    getIobStates() {
        return this.iobStates;
    }
    idToState(id) {
        for (const s in this.iobStates) {
            if (this.iobStates.hasOwnProperty(s)) {
                const st = this.iobStates[s];
                if (st.native && st.native.customTopic && st.native.customTopic.replace(/\//g, ".") === id) {
                    return s;
                }
            }
        }
        return undefined;
    }
    mqttStateChange(state, val) {
        if (state === "command") {
            if (typeof val === "string") {
                this.commandTopicValue = val;
            }
        }
        else if (state === "state") {
            if (typeof val === "string") {
                this.stateTopicValue = val;
            }
        }
        return;
    }
    iobStateVal(state) {
        if (state === "command") {
            return this.commandTopicValue === this.payloadOn;
        }
        else if (state === "state") {
            return this.stateTopicValue === this.stateOn;
        }
        return undefined;
    }
    stateToId(state) {
        const st = this.iobStates[state];
        if ((typeof st === "undefined") ||
            (typeof st.native === "undefined") ||
            (typeof st.native.customTopic === "undefined")) {
            return undefined;
        }
        return st.native.customTopic.replace(/\//g, ".");
    }
    iobStateChange(state, val) {
        if (state === "command") {
            if (typeof val === "boolean") {
                if (val) {
                    this.commandTopicValue = this.payloadOn;
                }
                else {
                    this.commandTopicValue = this.payloadOff;
                }
            }
        }
        else if (state === "state") {
            if (typeof val === "boolean") {
                if (val) {
                    this.stateTopicValue = this.stateOn;
                }
                else {
                    this.stateTopicValue = this.stateOff;
                }
            }
        }
    }
    mqttPayload(state) {
        if (state === "command") {
            return this.commandTopicValue;
        }
        else if (state === "state") {
            return this.stateTopicValue;
        }
        return undefined;
    }
}
exports.HaSwitch = HaSwitch;
