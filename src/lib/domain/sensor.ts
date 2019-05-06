import {renderString} from "nunjucks";
import {Domain} from "./domain";

/**
 * Not Supported config:
 * icon
 * qos
 * expire_after
 * force_update
 * unique_id
 * device_class
 * json_attributes
 */

export class HaSensor extends Domain {
    protected stateTopic: string;
    protected stateTopicValue: string;
    protected stateTopicValueRaw: string;
    protected valueTemplate?: string;
    protected jsonAttributesTopic?: string;
    protected jsonAttributesTopicValue?: string;
    protected unitOfMeasurement?: string;
    protected availabilityTopic?: string;
    protected payloadAvailable?: string;
    protected payloadNotAvailable?: string;
    protected availabilityTopicValue?: string;

    constructor(config: string) {
        super(config);
        this.name = this.getConfigString("name") || "MQTT Sensor";
        this.stateTopic = this.getConfigString("state_topic");
        this.stateTopicValue = "";
        this.stateTopicValueRaw = "";
        this.valueTemplate = this.getConfigString("value_template");
        this.unitOfMeasurement = this.getConfigString("unit_of_measurement");
        this.jsonAttributesTopic = this.getConfigString("json_attributes_topic");
        if (this.jsonAttributesTopic !== "") {
            this.jsonAttributesTopicValue = "";
        }
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
                    role: "value",
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
        };
        if (this.unitOfMeasurement) {
            this.iobStates.state.common["unit"] = this.unitOfMeasurement;
        }
    }

    public mqttStateChange(state: string, val: string) {
        if (state === "state") {
            if (typeof val === "string") {
                if (typeof this.valueTemplate === "undefined" || this.valueTemplate === "") {
                    this.stateTopicValue = val;
                } else {
                    try {
                        const valueJson: Record<string, string> = {
                            value_json: JSON.parse(val),
                        };
                        this.stateTopicValue = renderString(this.valueTemplate, valueJson);
                    } catch {
                        this.stateTopicValue = "";
                    }
                    this.stateTopicValueRaw = val;
                }
            }
        }
        return;
    }

    public iobStateVal(state: string): any | undefined {
        if (state === "state") {
            return this.stateTopicValue;
        }
        return undefined;
    }

    public iobStateChange(state: string, val: any) {
        if (state === "state") {
            if (typeof val === "string") {
                this.stateTopicValue = val;
            }
        }
    }

    public mqttPayload(state: string): any | undefined {
        if (state === "state") {
            if (typeof this.valueTemplate === "undefined" || this.valueTemplate === "") {
                return this.stateTopicValue;
            } else {
                return this.stateTopicValueRaw;
            }
        }
        return undefined;
    }
}
