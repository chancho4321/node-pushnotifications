const gcm = require('node-gcm');

const method = 'gcm';

const sendChunk = (GCMSender, registrationTokens, message, retries) => new Promise((resolve) => {
    GCMSender.send(message, { registrationTokens }, retries, (err, response) => {
        // Response: see https://developers.google.com/cloud-messaging/http-server-ref#table5
        if (err) {
            resolve({
                method,
                success: 0,
                failure: registrationTokens.length,
                message: registrationTokens.map(value => ({
                    regId: value,
                    error: err,
                })),
            });
        } else if (response && response.results !== undefined) {
            resolve({
                method,
                multicastId: response.multicast_id,
                success: response.success,
                failure: response.failure,
                message: response.results.map(value => ({
                    messageId: value.message_id,
                    regId: value.registration_id,
                    error: value.error ? new Error(value.error) : null,
                })),
            });
        } else {
            resolve({
                method,
                multicastId: response.multicast_id,
                success: response.success,
                failure: response.failure,
                message: registrationTokens.map(value => ({
                    regId: value,
                    error: new Error('unknown'),
                })),
            });
        }
    });
});

module.exports = (regIds, data, settings) => {
    const opts = Object.assign({}, settings.gcm);
    const id = opts.id;
    delete opts.id;
    const GCMSender = new gcm.Sender(id, opts);
    const promises = [];
    
    const message = new gcm.Message({ // See https://developers.google.com/cloud-messaging/http-server-ref#table5
        collapseKey: data.collapseKey,
        priority: data.priority,
        contentAvailable: data.contentAvailable || false,
        delayWhileIdle: data.delayWhileIdle || false,
        timeToLive: data.expiry - Math.floor(Date.now() / 1000) || data.timeToLive || 28 * 86400,
        restrictedPackageName: data.restrictedPackageName,
        dryRun: data.dryRun || false,
        data: {
            title: data.title, // Android, iOS (Watch)
            message: data.body, // Android, iOS
            icon: data.icon, // Android
            sound: data.sound, // Android, iOS
            badge: data.badge, // iOS
            tag: data.tag, // Android
            color: data.color, // Android
            custom: data.custom, // Phonegap plugin push compatibility
            click_action: data.clickAction || data.category, // Android, iOS
            body_loc_key: data.locKey, // Android, iOS
            body_loc_args: data.locArgs, // Android, iOS
            title_loc_key: data.titleLocKey, // Android, iOS
            title_loc_args: data.titleLocArgs, // Android, iOS
        },
    });
    let chunk = 0;

    // Split in 1.000 chunks, see https://developers.google.com/cloud-messaging/http-server-ref#table1
    do {
        const tokens = regIds.slice(chunk * 1000, (chunk + 1) * 1000);
        promises.push(sendChunk(GCMSender, tokens, message, data.retries || 0));
        chunk += 1;
    } while (1000 * chunk < regIds.length);

    return Promise.all(promises)
        .then((results) => {
            const resumed = {
                method,
                multicastId: [],
                success: 0,
                failure: 0,
                message: [],
            };
            for (const result of results) {
                if (result.multicastId) {
                    resumed.multicastId.push(result.multicastId);
                }
                resumed.success += result.success;
                resumed.failure += result.failure;
                resumed.message = [...resumed.message, ...result.message];
            }
            return resumed;
        });
};
