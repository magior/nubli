const nubli = require('../dist/index.js').default;

if (process.argv.length != 3) {
    console.log("Security PIN as argument required.");
    process.exit(1);
}

let pin = process.argv[2];

nubli.setDebug(true);

nubli.onReadyToScan()
    .then(() => {
        console.log("Ready to scan :)");
        nubli.startScanning();
    })
    .catch((err) => {
        console.log(err);
    });

nubli.on("smartLockDiscovered", async (smartlock) => {
    nubli.stopScanning();

    smartlock.on("connected", () => {
        console.log("connected");
    });

    if (smartlock.configExists()) {
        await smartlock.readConfig();
    }

    smartlock.connect()
        .then(async () => {
            if (smartlock.paired) {
                console.log("Good we're paired");
		    
	        console.log("Before")
                try {
                    let logs = await smartlock.requestLogs(pin);
                    console.log(JSON.stringify(logs, null, 4));
                } catch (error) {
                    console.log(error.message);
                }
                
                await smartlock.disconnect();
                process.exit(0);
            } else {
                console.log("Pair first :(");
                await smartlock.disconnect();
                process.exit(1);
            }
        });
});
