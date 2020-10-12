import express from "express";
import { Nubli } from "./nubli";
import { SmartLockPeripheralFilter } from "./smartLockPeripheralFilter";
import { SmartLock } from "./smartLock";
import { SmartLockResponse } from "./smartLockResponse";
const path = require('path');
const fs = require('fs');

const app = express();
const port = process.env.PORT || 8080; // default port to listen

const nubli = new Nubli(new SmartLockPeripheralFilter(''));
nubli.setDebug(true);

nubli.onReadyToScan().then(() => {
    console.log("Ready to scan :)");
    nubli.startScanning();
});

setTimeout(() => {
    nubli.stopScanning();
}, 10000);

const { exec } = require("child_process");

function resetBluetooth(): Promise<void>{
    return new Promise((resolve) => {
        exec("sudo hciconfig hci0 reset", (error: any, stdout:any, stderr:any) => {
            if (error) {
                console.log(`error: ${error.message}`);
                return;
            }
            if (stderr) {
                console.log(`stderr: ${stderr}`);
                return;
            }
            console.log(`stdout: ${stdout}`);
            resolve()
        });
    })
}

// resetBluetooth();

class ErrorResponse{
    constructor(public message: string, public error?: any){
    }
}

const directoryPath = './config/'

//passsing directoryPath and callback function
let configs = readConfigs();

console.log(configs);

const smartLocks: Map<string, SmartLock> = new Map<string, SmartLock>();

app.get("/:name/lock", (req, res) => {
    if(!configs[req.params.name]){
        res.status(404).send('Lock not present in config');
    }
    executeAction(configs[req.params.name].uuid, (smartLock) => {
        return lockUnlockAction(smartLock, (smartlock) => smartlock.lock());
    }).then(response => {
        res.status(200).send(response);
    }).catch(err => {
        res.status(400).send(err.message);
    });
});

app.get("/:name/unlock", (req, res) => {
    if(!configs[req.params.name]){
        res.status(404).send('Lock not present in config');
    }
    executeAction(configs[req.params.name].uuid, (smartLock) => {
        return lockUnlockAction(smartLock, (smartlock) => smartlock.unlock());
    }).then(response => {
        res.status(200).send(response);
    }).catch(err => {
        res.status(400).send(err.message);
    });
});

app.get("/:mac/pair/:name", (req, res) => {
    executeAction(req.params.mac, (lock) => {
        return pairAction(req.params.name, lock);
    }).then(() => {
        configs = readConfigs();
        res.status(200).send('Succesfully paired!');
    }).catch(err => {
        res.status(400).send(err.message);
    });
});

async function pairAction(name: string, smartlock: SmartLock): Promise<string>{
    return smartlock.pair(name)
        .then(async () => {
            console.log("successfully paired");
            await smartlock.saveConfig(directoryPath);
            await smartlock.disconnect();
            return 'sucessfully paired';
        })
        .catch((error) => {
            console.log("Pairing unsuccessful - error message: " + error);
            return Promise.reject(new ErrorResponse('Pairing unsuccessful, ' + error, error));
        });
}

async function lockUnlockAction(smartlock: SmartLock, action: (smartLock: SmartLock) => Promise<SmartLockResponse>): Promise<SmartLockResponse> {
    if (smartlock.paired) {
        console.log("Good we're paired");
        const response = await action(smartlock).then(async (data) => {
            await smartlock.disconnect();
            return data;
        });
        if(response){
            console.log(response);
        }
        return response;
    } else {
        console.log("Pair first :(");
        await smartlock.disconnect();
        return Promise.reject(new ErrorResponse('Please pair first'));
    }
}

function executeAction<T>(macAddress: string, action: (smartLock: SmartLock) => Promise<T>): Promise<T>{
    return new Promise((resolve, reject) => {
        // nubli.removeAllListeners();
        // if(smartLocks.has(macAddress)){
        //     console.log('using cached smartlock')
        //     return connectAndExecute(smartLocks.get(macAddress) as SmartLock, action, resolve, reject, undefined);
        // } else {
            const timer = setTimeout(() => {
                // nubli.stopScanning();
                reject(new ErrorResponse('Could not execute action within 15 seconds'));
            }, 15000);

            console.log(nubli.smartlocks.map(s => (s as any).device.address));
            return connectAndExecute(nubli.smartlocks.find(s => (s as any).device.address.replace(/-|:/g, '').toLowerCase() === macAddress.toLowerCase()) as SmartLock, action, resolve, reject, timer);
            // nubli.on('state', (state) => {
            //     console.log('state change', state);
            // })
            // nubli.onReadyToScan()
            //         .then(() => {
            //             console.log("Ready to scan :)");
            //             nubli.startScanning();
            //         })
            //         .catch((err) => {
            //             clearTimeout(timer);
            //             console.log(err);
            //             reject(new ErrorResponse('Failed to scan'));
            //         });
        
            // nubli.once("smartLockDiscovered", async (smartlock: SmartLock) => {
            //     console.log('Discovered smart lock', smartlock);
            //     smartLocks.set(macAddress, smartlock);
            //     nubli.stopScanning();
        
            //     smartlock.once("connected", () => {
            //         console.log("connected");
            //     });
        
            //     // smartlock.on('rssiUpdate', (rssi) => {
            //     //     console.log(rssi);
            //     // })
        
            //     return connectAndExecute(smartlock, action, resolve, reject, timer);
            // });
    });
    
}

async function connectAndExecute<T>(smartlock: SmartLock,  action: (smartLock: SmartLock) => Promise<T>, resolve: Function, reject: Function, timer: any){
    // await resetBluetooth();
    if (smartlock.configExists()) {
        await smartlock.readConfig();
    }
    console.log('Going to connect', (smartlock as any).device.address)
    smartlock.connect()
        .then(() => {
            console.log('connected!')
            return action(smartlock).then((data) => {
                resolve(data);
            }).catch(err => {
                reject(err);
            })
        }).catch((err) => {
            console.log(err);
            reject(new ErrorResponse('Unknown error while connecting', err));
        }).finally(() => {
            clearTimeout(timer);
        });
}

function readConfigs(){
    const files = fs.readdirSync(directoryPath);
    return files
    .map((f: any) => fs.readFileSync(directoryPath + '/' + f))
    .map((content: string) => JSON.parse(content))
    .reduce((acum: any, current: any) => {
        acum[current.name] = current;
        return acum;
    }, {});
}

// start the express server
app.listen(port, () => {
    // tslint:disable-next-line:no-console
    console.log(`server started at http://localhost:${port}`);
});
