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
    protected commandTopic: string;
    protected payloadOn: string;
    protected payloadOff: string;
    protected commandTopicValue: string;
    protected stateTopic: string;
    protected stateOn: string;
    protected stateOff: string;
    protected stateTopicValue: string;
    protected availabilityTopic?: string;
    protected payloadAvailable?: string;
    protected payloadNotAvailable?: string;
    protected availabilityTopicValue?: string;
    protected iobStates: Record<string, any>;

    constructor(config: string) {
        super(config);
        this.name = this.getConfigString("name") || "MQTT Switch";
        this.commandTopic = this.getConfigString("command_topic");
        this.payloadOn = this.getConfigString("payload_on") || "ON";
        this.payloadOff = this.getConfigString("payload_off") || "OFF";
        this.commandTopicValue = this.payloadOff;
        this.stateTopic = this.getConfigString("state_topic");
        this.stateOn = this.getConfigString("state_on") || this.payloadOn || "ON";
        this.stateOff = this.getConfigString("state_off") || this.payloadOff || "OFF";
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
                    name: "command",
                    type: "boolean",
                    desc: "Set switch state",
                    read: false,
                    write: true,
                },
                native: {
                    customTopic: this.commandTopic,
                },
            },
        };
    }

    public getIobStates() {
        return this.iobStates;
    }

    public idToState(id: string) {
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

    public mqttStateChange(state: string, val: string) {
        if (state === "command") {
            if (typeof val === "string") {
                this.commandTopicValue = val;
            }
        } else if (state === "state") {
            if (typeof val === "string") {
                this.stateTopicValue = val;
            }
        }
        return;
    }

    public iobStateVal(state: string): any | undefined {
        if (state === "command") {
            return this.commandTopicValue === this.payloadOn;
        } else if (state === "state") {
            return this.stateTopicValue === this.stateOn;
        }
        return undefined;
    }

    public stateToId(state: string): string | undefined {
        const st = this.iobStates[state];
        if ((typeof st === "undefined") ||
            (typeof st.native === "undefined") ||
            (typeof st.native.customTopic === "undefined")) {
            return undefined;
        }
        return st.native.customTopic.replace(/\//g, ".");
    }

    public iobStateChange(state: string, val: any) {
        if (state === "command") {
            if (typeof val === "boolean") {
                if (val) {
                    this.commandTopicValue = this.payloadOn;
                } else {
                    this.commandTopicValue = this.payloadOff;
                }
            }
        } else if (state === "state") {
            if (typeof val === "boolean") {
                if (val) {
                    this.stateTopicValue = this.stateOn;
                } else {
                    this.stateTopicValue = this.stateOff;
                }
            }
        }
    }

    public mqttPayload(state: string): any | undefined {
        if (state === "command") {
            return this.commandTopicValue;
        } else if (state === "state") {
            return this.stateTopicValue;
        }
        return undefined;
    }
}
