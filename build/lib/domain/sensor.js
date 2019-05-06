"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const nunjucks_1 = require("nunjucks");
const domain_1 = require("./domain");
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
class HaSensor extends domain_1.Domain {
    constructor(config) {
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
    mqttStateChange(state, val) {
        if (state === "state") {
            if (typeof val === "string") {
                if (typeof this.valueTemplate === "undefined" || this.valueTemplate === "") {
                    this.stateTopicValue = val;
                }
                else {
                    try {
                        const valueJson = {
                            value_json: JSON.parse(val),
                        };
                        this.stateTopicValue = nunjucks_1.renderString(this.valueTemplate, valueJson);
                    }
                    catch (_a) {
                        this.stateTopicValue = "";
                    }
                    this.stateTopicValueRaw = val;
                }
            }
        }
        return;
    }
    iobStateVal(state) {
        if (state === "state") {
            return this.stateTopicValue;
        }
        return undefined;
    }
    iobStateChange(state, val) {
        if (state === "state") {
            if (typeof val === "string") {
                this.stateTopicValue = val;
            }
        }
    }
    mqttPayload(state) {
        if (state === "state") {
            if (typeof this.valueTemplate === "undefined" || this.valueTemplate === "") {
                return this.stateTopicValue;
            }
            else {
                return this.stateTopicValueRaw;
            }
        }
        return undefined;
    }
}
exports.HaSensor = HaSensor;
