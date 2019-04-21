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
    "switch": HaSwitch,
//    "vacuum",
};

export type hassState = string | boolean | number

export type hassAttr = string | boolean | number

export interface hassDevice {
    domain: string;
    entityID: string;
    nodeID?: string;
    state?: hassState;
    attrs?: Record<string, hassAttr>;
    //TODO: fix any
    instant: any;
}

export function deleteDevice(id: string, callback?: (dev: hassDevice) => void) {

}

export function addDevice(id: string, val: string, callback: (dev: hassDevice) => void) {
    const configReg = new RegExp(`(\w*\.)+config`);
    const match = configReg.exec(id);
    let dev: hassDevice = {
        domain: "",
        entityID: "",
        instant: undefined
    };
    if (!match || match.length > 3) {
        return;
    }
    if (match.length === 3) {
        dev.domain = match[0];
        dev.nodeID = match[1];
        dev.entityID = match[2];
    } else if (match.length === 2) {
        dev.domain = match[0];
        dev.entityID = match[1];
    }

    if (!supportedDomain[dev.domain]) {
        // This domain not supported.
        return;
    }
    dev.instant = new supportedDomain[dev.domain](val);
    callback(dev);
}

export function stateChange(id: string, val: string, callback: (state: hassState) => void) {

}

export function attributeChange(id: string, val: string, callback: (attr: hassAttr) => void) {

}