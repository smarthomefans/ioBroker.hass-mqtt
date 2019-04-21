"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const switch_1 = require("./domain/switch");
const supportedDomain = {
    //    "alarm_control_panel",
    //    "binary_sensor": null,
    //    "camera",
    //    "cover": null,
    //    "fan",
    //    "climate",
    //    "light",
    //    "lock": null,
    //    "sensor": null,
    "switch": switch_1.HaSwitch,
};
function deleteDevice(id, callback) {
}
exports.deleteDevice = deleteDevice;
function addDevice(id, val, callback) {
    const configReg = new RegExp(`(\w*\.)+config`);
    const match = configReg.exec(id);
    let dev = {
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
    }
    else if (match.length === 2) {
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
exports.addDevice = addDevice;
function stateChange(id, val, callback) {
}
exports.stateChange = stateChange;
function attributeChange(id, val, callback) {
}
exports.attributeChange = attributeChange;
