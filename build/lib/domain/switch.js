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
        this.command_topic = this.getConfigString("command_topic");
        this.payload_on = this.getConfigString("payload_on") || "ON";
        this.payload_off = this.getConfigString("payload_off") || "OFF";
        this.state_topic = this.getConfigString("state_topic");
        this.state_on = this.getConfigString("state_on") || "ON";
        this.state_off = this.getConfigString("state_off") || "OFF";
        this.availability_topic = this.getConfigString("availability_topic");
        if (this.availability_topic !== "") {
            this.payload_available = this.getConfigString("payload_available") || "online";
            this.payload_not_available = this.getConfigString("payload_not_available") || "offline";
        }
    }
    getIobStates() {
        return {
            "state": {
                type: "state",
                common: {
                    role: "switch",
                    name: "Switch current state",
                    type: "boolean",
                    read: true,
                    write: true
                }
            }
        };
    }
}
exports.HaSwitch = HaSwitch;
