import express from "express";
import { Nubli } from "./nubli";
import { SmartLockPeripheralFilter } from "./smartLockPeripheralFilter";
import { SmartLock } from "./smartLock";
import { SmartLockResponse } from "./smartLockResponse";

const app = express();
const port = 8080; // default port to listen

class ActionResponse{
    constructor(public success: boolean, public response?: SmartLockResponse, public message?: string){
    }
}

// define a route handler for the default home page
app.get("/:mac/lock", (req, res) => {
    executeAction(req.params.mac, (smartLock) => {
        return smartLock.lock()
    }).then(response => {
        if(response.success){
            res.status(200).send(response.response);
        } else {
            res.status(400).send(response.message);
        }
    });
});

// define a route handler for the default home page
app.get("/:mac/unlock", (req, res) => {
    executeAction(req.params.mac, (smartLock) => {
        return smartLock.unlock()
    }).then(response => {
        if(response.success){
            res.status(200).send(response.response);
        } else {
            res.status(400).send(response.message);
        }
    });
});

function executeAction(macAddress: string, action: (smartLock: SmartLock) => Promise<SmartLockResponse>): Promise<ActionResponse>{
    return new Promise((resolve) => {
        const nubli = new Nubli(new SmartLockPeripheralFilter(macAddress));

        const timer = setTimeout(() => {
            resolve(new ActionResponse(false, undefined, 'Could not execute action within 15 seconds'));
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
                    resolve(new ActionResponse(false, undefined, 'Failed to scan'));
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
                    .then(async () => {
                        if (smartlock.paired) {
                            console.log("Good we're paired");
                            let lockState = await action(smartlock);
                            console.log(lockState);
                            await smartlock.disconnect();
                            clearTimeout(timer);
                            resolve(new ActionResponse(true, lockState));
                        } else {
                            console.log("Pair first :(");
                            await smartlock.disconnect();
                            clearTimeout(timer);
                            resolve(new ActionResponse(false,undefined, 'Please pair first'));
                        }
    
                    }, (err) => {
                        clearTimeout(timer);
                        resolve(new ActionResponse(false, undefined, 'Unknown error while connecting'));
                    });
        });
    });
    
}

// start the express server
app.listen(port, () => {
    // tslint:disable-next-line:no-console
    console.log(`server started at http://localhost:${port}`);
});
