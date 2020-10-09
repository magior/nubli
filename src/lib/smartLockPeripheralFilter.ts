import { PeripheralFilter } from "./peripheralFilter";

export class SmartLockPeripheralFilter implements PeripheralFilter {
    constructor(public name: string) {
    }

    handle(peripheral: import("@abandonware/noble").Peripheral): boolean {

        // if (data !== undefined && data !== null && data.length == 25) {
        //     let type: number = data.readUInt8(2);
        //     let dataLength: number = data.readUInt8(3);
        //
        //     // 0x02 == iBeacon
        //     if (type == 2 && dataLength == 21) {
        //         let serviceUuid: string = data.slice(4, 20).toString('hex');
        //
        //         if (serviceUuid == SmartLock.NUKI_SERVICE_UUID) {
        //             return true;
        //         }
        //     }
        // } else {
        let name: string = peripheral.advertisement.localName;
        return name!==undefined && peripheral.advertisement.localName.slice(5)===this.name;
        // }

    }
}
