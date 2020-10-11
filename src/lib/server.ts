import express from "express";
import { Nubli } from "./nubli";
import { SmartLockPeripheralFilter } from "./smartLockPeripheralFilter";
import { SmartLock } from "./smartLock";
import { SmartLockResponse } from "./smartLockResponse";
const path = require('path');
const fs = require('fs');

const app = express();
const port = process.env.PORT || 8080; // default port to listen

class ErrorResponse{
    constructor(public message: string, public error?: any){
    }
}

const directoryPath = './config/'

//passsing directoryPath and callback function
let configs = readConfigs();

console.log(configs);

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
        const nubli = new Nubli(new SmartLockPeripheralFilter(macAddress));

        const timer = setTimeout(() => {
            reject(new ErrorResponse('Could not execute action within 15 seconds'));
        }, 15000);

        nubli.on('state', (state) => {
            console.log('state change', state);
        })
        nubli.onReadyToScan()
                .then(() => {
                    console.log("Ready to scan :)");
                    nubli.startScanning();
                })
                .catch((err) => {
                    clearTimeout(timer);
                    console.log(err);
                    reject(new ErrorResponse('Failed to scan'));
                });
    
        nubli.on("smartLockDiscovered", async (smartlock: SmartLock) => {
            nubli.stopScanning();
    
            smartlock.on("connected", () => {
                console.log("connected");
            });
    
            // smartlock.on('rssiUpdate', (rssi) => {
            //     console.log(rssi);
            // })
    
            if (smartlock.configExists()) {
                await smartlock.readConfig();
            }
    
            return smartlock.connect()
                    .then(() => {
                        return action(smartlock).then((data) => {
                            resolve(data);
                        }).catch(err => {
                            reject(err);
                        })
                    }).catch((err) => {
                        reject(new ErrorResponse('Unknown error while connecting', err));
                    }).finally(() => {
                        clearTimeout(timer);
                    });
        });
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
