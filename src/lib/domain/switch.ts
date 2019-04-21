import {Domain} from "./domain";

/**
 * Not supported config:
 *  icon
 *  optimistic
 *  qos
 *  retain
 *  value_template
 *  json_attributes_topic
 */
export class HaSwitch extends Domain {
    command_topic: string;
    payload_on: string;
    payload_off: string;
    state_topic: string;
    state_on: string;
    state_off: string;
    availability_topic?: string;
    payload_available?: string;
    payload_not_available?: string;

    constructor(config: string) {
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
                    type:  "boolean",
                    read:  true,
                    write: true
                }
            }
        };
    }
}