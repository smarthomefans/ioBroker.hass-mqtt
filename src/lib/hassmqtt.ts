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

export interface HassDevice {
    domain: string;
    entityID: string;
    friendlyName: string;
    nodeID?: string;
    state?: hassState;
    attrs?: Record<string, hassAttr>;
    // TODO: fix any
    instant: any;
}

export function deleteDevice(id: string, callback?: (dev: HassDevice) => void) {

}

export function addDevice(id: string, val: string, callback: (dev: HassDevice) => void) {
    const match = id.split(".");
    const dev: HassDevice = {
        domain: "",
        entityID: "",
        friendlyName: "",
        instant: undefined,
    };
    if (!match || match.length > 4) {
        return;
    }
    if (match.length === 4) {
        dev.domain = match[0];
        dev.nodeID = match[1];
        dev.entityID = match[2];
        dev.friendlyName = match[2];
    } else if (match.length === 3) {
        dev.domain = match[0];
        dev.entityID = match[1];
        dev.friendlyName = match[1];
    }

    if (!supportedDomain[dev.domain]) {
        // This domain not supported.
        return;
    }
    dev.instant = new supportedDomain[dev.domain](val);
    if (dev.instant.name) {
        dev.friendlyName = dev.instant.name;
    }
    callback(dev);
}

export function stateChange(id: string, val: string, callback: (state: hassState) => void) {

}

export function attributeChange(id: string, val: string, callback: (attr: hassAttr) => void) {

}