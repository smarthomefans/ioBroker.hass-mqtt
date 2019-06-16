import {Domain} from "./domain/domain";
import {HaSensor} from "./domain/sensor";
import {HaSwitch} from "./domain/switch";

const supportedDomain: Record<string, any> = {
//    "alarm_control_panel",
//    "binary_sensor": null,
//    "camera",
//    "cover": null,
//    "fan",
//    "climate",
//    "light",
//    "lock": null,
    sensor: HaSensor,
    switch: HaSwitch,
//    "vacuum",
};

export type hassState = string | boolean | number;

export type hassAttr = string | boolean | number;

export class HassDevice {
    public domain: string;
    public entityID: string;
    public friendlyName: string;
    public nodeID?: string;
    public state?: hassState;
    public attrs?: Record<string, hassAttr>;
    private _instant?: Domain;

    constructor(id: string, val: string) {
        this.domain = "";
        this.entityID = "";
        this.friendlyName = "";

        const match = id.split(".");

        try {
            JSON.parse(val);
        } catch (e) {
            return ;
        }

        if (!match || match.length > 5) {
            return;
        }
        if (match.length === 5) {
            this.domain = match[1];
            this.nodeID = match[2];
            this.entityID = match[3];
            this.friendlyName = match[3];
        } else if (match.length === 4) {
            this.domain = match[1];
            this.entityID = match[2];
            this.friendlyName = match[2];
        }

        if (!supportedDomain[this.domain]) {
            // This domain not supported.
            return;
        }
        this._instant = new supportedDomain[this.domain](val);
        if (typeof this._instant === "undefined") {
            return;
        }

        if (this._instant.name) {
            this.friendlyName = this._instant.name;
        }
    }

    public get iobStates() {
        if (typeof this._instant === "undefined") {
            return {};
        }
        return this._instant.iobStates;
    }

    public get iobRole() {
        if (this.domain === "switch") return "switch";
        if (this.domain === "sensor") return "value";
        else return "";
    }

    public get iobChannel() {
        if (this.domain === "switch") return "switch";
        if (this.domain === "sensor") return "value";
        else return "";
    }

    public get ready() {
        return (typeof this._instant !== "undefined");
    }

    /**
     * Read mqtt message from broker. Update the ioBroker READABLE state
     * @param id MQTT Topic
     * @param val MQTT Topic Value
     * @param callback update object value
     */
    public mqttStateChange(id: string, val: string, callback: (err: string | null, state?: string, iobVal?: any) => void) {
        if (typeof this._instant === "undefined") {
            callback("Uninitialized device");
            return;
        }
        // One topic ID may mapped to multiple states
        const states = this._instant.idToReadableStates(id);
        for (const state of states) {
            const oldVal = this._instant.getReadableStateMqttPayload(state);
            if (val !== oldVal) {
                this._instant.mqttStateChange(state, val, (iobVal: any) => {
                    callback(null, state, iobVal);
                });
            } else {
                callback("NO CHANGE");
            }
        }
    }

    /**
     * Read ioBroker WRITEABLE state change message, Write to mqtt broker
     * @param id ioBroker state id
     * @param val ioBroker state value
     * @param callback send mqtt message
     */
    public iobStateChange(id: string, val: any, callback: (err: string | null, mqttTopic?: string, mqttVal?: any) => void) {
        if (typeof this._instant === "undefined") {
            callback("Uninitialized device");
            return;
        }
        const match = id.split(".");
        if (!match || match.length < 3) {
            callback(`Invalid ioBroker state ID: ${id}`);
            return;
        }
        const state = match[match.length - 1];
        const mqttTopic = this._instant.writeableStateToTopic(state);
        if (mqttTopic === "") {
            callback("NO NEED");
            return;
        }

        this._instant.iobStateChange(state, val, (mqttPayload: string) => {
            callback(null, mqttTopic, mqttPayload);
        });
    }
}
