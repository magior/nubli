import { SmartLockCommand } from "./SmartLockCommand";
import { Command } from "../states";
import { ActionState } from "../states";
import { LockAction } from "../states";
import { Trigger } from "../states";
import { DoorSensorLog } from "../states";
import { SmartLock } from "../smartLock";

export class RequestLogsCommand extends SmartLockCommand {
    readonly requiresChallenge = true;
    private pin: number;
    private sort: number;
    private count: number;

    constructor(pin: number, count: number = 3, sort: number = 1) {
        super();

        this.pin = pin;
        this.sort = sort;
        this.count = count;

        this._response.data = {
            logs: []
        };
    }
    
    requestData(): Buffer {
        let payload: Buffer = new Buffer(8);

	payload.writeUInt32LE(0 ,0); //start index
	payload.writeUInt16LE(this.count, 4); // count 
	payload.writeUIntLE(this.sort, 6, 1); // sort 01 descending
	payload.writeUIntLE(0, 7, 1); // send total

        let pinBuf: Buffer = new Buffer(2);
        pinBuf.writeUInt16LE(this.pin, 0);

        payload = Buffer.concat([payload, this.challenge, pinBuf]);
	console.log('log payload' + payload.toString('hex'))
        return SmartLock.prepareCommand(Command.REQUEST_LOG_ENTRIES, payload);
    }

    handleData(command: number, payload: Buffer): void {
	    //console.log('handle' + command)
        if (command == Command.LOG_ENTRIES_COUNT) {
            this._response.data.count = payload.readUInt16LE(1);

            if (this._response.data.count == 0) {
                this._complete = true;
            }
        } else if (command == Command.LOG_ENTRY) {
            let entry: any = {};

	    console.log(payload)
            entry.index = payload.readUInt32LE(0);

            let year: number = payload.readUInt16LE(4);
            let month: number = payload.readUInt8(6) - 1;
            let day : number= payload.readUInt8(7);
            let hour: number = payload.readUInt8(8);
            let minute: number = payload.readUInt8(9);
            let second: number = payload.readUInt8(10);
    
            entry.timestamp = new Date(year, month, day, hour, minute, second);

            entry.authid = payload.readUInt32LE(11);
            entry.name = payload.slice(15, 46).toString('utf8').replace(/\0/g, '');

            let type: number = payload.readUInt8(47);
	    switch (type) {
		case 1: // logging enabled/disabled
		  entry.type = "Logging enabled/disabled"
		  break;;
		case 2: // lock action
		  entry.type = "Lock action"
		  let state: number = payload.readUInt8(48)
		  let trigger: number = payload.readUInt8(49)
		  let completion: number = payload.readUInt8(51)
		  let flags: number = payload.readUInt8(50)
		  entry.action=LockAction[state] + ' ' + Trigger[trigger]
		  entry.flags=flags
		  entry.result=ActionState[completion]
		  break;;
		case 3: 
		  entry.type = "Calibration"
		  break;;
		case 6: 
		  entry.type = "Door sensor"
                  entry.status = DoorSensorLog[payload.readUInt8(48)]
		  break;;
		case 7:
		  entry.type = "Door sensor logging enable/disable"
		  break;;
		default:
		  entry.type = type
		

	    }

            this._response.data.logs.push(entry);
        } else if (command == Command.STATUS) {
            let status: number = payload.readUInt8(0);

            if (status == 0 && this._response.data.logs.length == this.count) {
                this._complete = true;
            } else {
                this._complete = true;
                this._response.success = false;
            }
        }
    }

}
