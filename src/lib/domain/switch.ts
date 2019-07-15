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
    private commandTopic: string;
    private payloadOn: string;
    private payloadOff: string;
    private stateTopic: string;
    private stateOn: string;
    private stateOff: string;
    private availabilityTopic?: string;
    private payloadAvailable?: string;
    private payloadNotAvailable?: string;

    constructor(config: string) {
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
                    role: "state",
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
    public mqttStateChange(stateID: string, mqttPayload: string, callback: (iobVal: any) => void) {
        if (stateID === "command") {
            if ((mqttPayload === this.stateOn) || (mqttPayload === this.stateOff)) {
                if (typeof this._mqttPayloadCatch.command === "object") {
                    this._mqttPayloadCatch.command.r = mqttPayload;
                    callback(mqttPayload === this.stateOn);
                }
            }
        } else if (stateID === "state") {
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
    public iobStateChange(stateID: string, val: any, callback: (mqttPayload: string) => void) {
        if (stateID === "command") {
            if ((typeof val === "boolean") && (typeof this._mqttPayloadCatch.command === "object")) {
                if (val) {
                    this._mqttPayloadCatch.command.w = this.payloadOn;
                    callback(this.payloadOn);
                } else {
                    this._mqttPayloadCatch.command.w = this.payloadOff;
                    callback(this.payloadOff);
                }
            }
        }
    }
}
