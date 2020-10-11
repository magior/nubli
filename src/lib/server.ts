import express from "express";
import { Nubli } from "./nubli";
import { SmartLockPeripheralFilter } from "./smartLockPeripheralFilter";
import { SmartLock } from "./smartLock";
import { SmartLockResponse } from "./smartLockResponse";

const app = express();
const port = 8080; // default port to listen

// define a route handler for the default home page
app.get("/:mac/lock", (req, res) => {
    executeAction(req, res, (smartLock) => {
        return smartLock.lock()
    });
});

// define a route handler for the default home page
app.get("/:mac/unlock", (req, res) => {
    executeAction(req, res, (smartLock) => {
        return smartLock.unlock()
    });
});

function executeAction(req: any, res: any, action: (smartLock: SmartLock) => Promise<SmartLockResponse>){
    const nubli = new Nubli(new SmartLockPeripheralFilter(req.params.mac));
    nubli.on('state', (state) => {
        console.log('state change', state);
    })
    nubli.onReadyToScan()
            .then(() => {
                console.log("Ready to scan :)");
                nubli.startScanning();
            })
            .catch((err) => {
                res.status(500).send(err);
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

        smartlock.connect()
                .then(async () => {
                    if (smartlock.paired) {
                        console.log("Good we're paired");
                        let lockState = await action(smartlock);
                        console.log(lockState);
                        await smartlock.disconnect();
                        res.status(200).send(lockState)
                    } else {
                        console.log("Pair first :(");
                        await smartlock.disconnect();
                        res.status(400).send('Pair the lock first!');
                    }

                }, (err) => {
                    res.status(500).send(err);
                });
    });
}

// start the express server
app.listen(port, () => {
    // tslint:disable-next-line:no-console
    console.log(`server started at http://localhost:${port}`);
});
