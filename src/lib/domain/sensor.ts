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
    private stateTopic: string;
    private valueTemplate?: string;
    private jsonAttributesTopic?: string;
    private unitOfMeasurement?: string;
    private availabilityTopic?: string;
    private payloadAvailable?: string;
    private payloadNotAvailable?: string;

    constructor(config: string) {
        super(config);
        this.name = this.getConfigString("name") || "MQTT Sensor";
        this.stateTopic = this.getConfigString("state_topic");
        this.valueTemplate = this.getConfigString("value_template");
        this.unitOfMeasurement = this.getConfigString("unit_of_measurement");
        this.jsonAttributesTopic = this.getConfigString("json_attributes_topic");
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
        this._mqttPayloadCatch = {
            state: "",
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
        if (stateID === "state") {
            if (typeof this.valueTemplate === "undefined" || this.valueTemplate === "") {
                if (typeof this._mqttPayloadCatch.state === "string") {
                    this._mqttPayloadCatch.state = mqttPayload;
                }
                callback(mqttPayload);
            } else {
                try {
                    const valueJson: Record<string, string> = {
                        value_json: JSON.parse(mqttPayload),
                    };
                    const val = renderString(this.valueTemplate, valueJson);
                    if (typeof this._mqttPayloadCatch.state === "string") {
                        this._mqttPayloadCatch.state = mqttPayload;
                    }
                    callback(val);
                } catch {
                    return;
                }
            }
        }
        return;
    }
}
