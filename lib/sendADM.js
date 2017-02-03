'use strict';

var adm = require('node-adm');

var method = 'adm';

module.exports = function (regIds, _data, settings) {
    var resumed = {
        method: method,
        success: 0,
        failure: 0,
        message: []
    };
    var promises = [];
    var admSender = new adm.Sender(settings.adm);
    var data = Object.assign({}, _data);
    var consolidationKey = data.consolidationKey;
    var expiry = data.expiry;
    var timeToLive = data.timeToLive;

    delete data.consolidationKey;
    delete data.expiry;
    delete data.timeToLive;

    var message = {
        expiresAfter: expiry - Math.floor(Date.now() / 1000) || timeToLive || 28 * 86400,
        consolidationKey: consolidationKey,
        data: data
    };

    regIds.forEach(function (regId) {
        admSender.send(message, regId, function (err, response) {
            resumed.success += err || response.error ? 0 : 1;
            resumed.failure += err || response.error ? 1 : 0;
            resumed.message.push({
                regId: regId,
                error: err || (response.error ? new Error(response.error) : null)
            });
            promises.push(Promise.resolve());
        });
    });

    return Promise.all(promises).then(function () {
        return resumed;
    });
};