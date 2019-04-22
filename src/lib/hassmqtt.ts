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
//    "sensor": null,
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
    // TODO: fix any
    private _instant: any;

    constructor(id: string, val: string) {
        this.domain = "";
        this.entityID = "";
        this.friendlyName = "";
        this._instant = undefined;

        const match = id.split(".");

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
        if (this._instant.name) {
            this.friendlyName = this._instant.name;
        }
    }

    public get iobStates() {
        return this._instant.getIobStates();
    }

    public get ready() {
        return (typeof this._instant !== "undefined");
    }

    public stateChange(id: string, val: any) {
        this._instant.stateChange(id, val);
    }
}
