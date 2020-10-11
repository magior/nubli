import express from "express";
import { Nubli } from "./nubli";
import { SmartLockPeripheralFilter } from "./smartLockPeripheralFilter";
import { SmartLock } from "./smartLock";

const app = express();
const port = 8080; // default port to listen

const nubli = new Nubli(new SmartLockPeripheralFilter('15541A95', '54:D2:72:54:1A:95'));

nubli.on('state', (state) => {
    console.log('state change', state);
})

// define a route handler for the default home page
app.get("/:name/lock", (req, res) => {

    nubli.onReadyToScan()
            .then(() => {
                console.log("Ready to scan :)");
                nubli.startScanning();
            })
            .catch((err) => {
                console.log(err);
            });

    nubli.on("smartLockDiscovered", async (smartlock: SmartLock) => {
        nubli.stopScanning();

        smartlock.on("connected", () => {
            console.log("connected");
        });

        smartlock.on('rssiUpdate', (rssi) => {
            console.log(rssi);
        })

        if (smartlock.configExists()) {
            await smartlock.readConfig();
        }

        smartlock.connect()
                .then(async () => {
                    if (smartlock.paired) {
                        console.log("Good we're paired");
                        let lockState = await smartlock.lock((response: any) => {
                            console.log(response);
                        });
                        console.log(lockState);
                    } else {
                        console.log("Pair first :(");
                    }

                    await smartlock.disconnect();
                });
    });
});

// start the express server
app.listen(port, () => {
    // tslint:disable-next-line:no-console
    console.log(`server started at http://localhost:${port}`);
});
