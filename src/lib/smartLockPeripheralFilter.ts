import { PeripheralFilter } from "./peripheralFilter";
import { SmartLock } from "./smartLock";

export class SmartLockPeripheralFilter implements PeripheralFilter {
    constructor(public macAddress?: string) {
    }

    handle(peripheral: import("@abandonware/noble").Peripheral): boolean {
        let data: Buffer = peripheral.advertisement.manufacturerData;

        if (this.macAddress) {
            return peripheral.address.replace(/-|:/g, '')===this.macAddress.replace(/-|:/g, '').toLowerCase();
        } else if (data!==undefined && data!==null && data.length==25) {
            let type: number = data.readUInt8(2);
            let dataLength: number = data.readUInt8(3);

            // 0x02 == iBeacon
            if (type==2 && dataLength==21) {
                let serviceUuid: string = data.slice(4, 20).toString('hex');
                return serviceUuid==SmartLock.NUKI_SERVICE_UUID;
            }
            return false;
        } else {
            let name: string = peripheral.advertisement.localName;
            return name!==undefined && peripheral.advertisement.localName.slice(0, 5)==="Nuki_";
        }

    }
}
