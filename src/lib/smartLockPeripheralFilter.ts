import { PeripheralFilter } from "./peripheralFilter";

export class SmartLockPeripheralFilter implements PeripheralFilter {
    constructor(public name: string, public macAddress: string) {
    }

    handle(peripheral: import("@abandonware/noble").Peripheral): boolean {
        let data: Buffer = peripheral.advertisement.manufacturerData;
        
        if (data !== undefined && data !== null && data.length == 25) {
            let type: number = data.readUInt8(2);
            let dataLength: number = data.readUInt8(3);
        
            // 0x02 == iBeacon
            if (type == 2 && dataLength == 21) {
                // let serviceUuid: string = data.slice(4, 20).toString('hex');
                let macAddress: string = data.toString('hex').slice(-14).slice(0, -2);
                console.log(macAddress);
                return this.macAddress.replace(/:/g, '') === macAddress;
            }
            return false;
        } else {
            let name: string = peripheral.advertisement.localName;
            return name!==undefined && peripheral.advertisement.localName.slice(5)===this.name;
        }

    }
}
