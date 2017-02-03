'use strict';

function _toConsumableArray(arr) { if (Array.isArray(arr)) { for (var i = 0, arr2 = Array(arr.length); i < arr.length; i++) { arr2[i] = arr[i]; } return arr2; } else { return Array.from(arr); } }

var gcm = require('node-gcm');

var method = 'gcm';

var sendChunk = function sendChunk(GCMSender, registrationTokens, message, retries) {
    return new Promise(function (resolve) {
        GCMSender.send(message, { registrationTokens: registrationTokens }, retries, function (err, response) {
            // Response: see https://developers.google.com/cloud-messaging/http-server-ref#table5
            if (err) {
                resolve({
                    method: method,
                    success: 0,
                    failure: registrationTokens.length,
                    message: registrationTokens.map(function (value) {
                        return {
                            regId: value,
                            error: err
                        };
                    })
                });
            } else if (response && response.results !== undefined) {
                resolve({
                    method: method,
                    multicastId: response.multicast_id,
                    success: response.success,
                    failure: response.failure,
                    message: response.results.map(function (value) {
                        return {
                            messageId: value.message_id,
                            regId: value.registration_id,
                            error: value.error ? new Error(value.error) : null
                        };
                    })
                });
            } else {
                resolve({
                    method: method,
                    multicastId: response.multicast_id,
                    success: response.success,
                    failure: response.failure,
                    message: registrationTokens.map(function (value) {
                        return {
                            regId: value,
                            error: new Error('unknown')
                        };
                    })
                });
            }
        });
    });
};

module.exports = function (regIds, data, settings) {
    var opts = Object.assign({}, settings.gcm);
    var id = opts.id;
    delete opts.id;
    var GCMSender = new gcm.Sender(id, opts);
    var promises = [];

    var message = new gcm.Message({ // See https://developers.google.com/cloud-messaging/http-server-ref#table5
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
            title_loc_args: data.titleLocArgs }
    });
    var chunk = 0;

    // Split in 1.000 chunks, see https://developers.google.com/cloud-messaging/http-server-ref#table1
    do {
        var tokens = regIds.slice(chunk * 1000, (chunk + 1) * 1000);
        promises.push(sendChunk(GCMSender, tokens, message, data.retries || 0));
        chunk += 1;
    } while (1000 * chunk < regIds.length);

    return Promise.all(promises).then(function (results) {
        var resumed = {
            method: method,
            multicastId: [],
            success: 0,
            failure: 0,
            message: []
        };
        var _iteratorNormalCompletion = true;
        var _didIteratorError = false;
        var _iteratorError = undefined;

        try {
            for (var _iterator = results[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
                var result = _step.value;

                if (result.multicastId) {
                    resumed.multicastId.push(result.multicastId);
                }
                resumed.success += result.success;
                resumed.failure += result.failure;
                resumed.message = [].concat(_toConsumableArray(resumed.message), _toConsumableArray(result.message));
            }
        } catch (err) {
            _didIteratorError = true;
            _iteratorError = err;
        } finally {
            try {
                if (!_iteratorNormalCompletion && _iterator.return) {
                    _iterator.return();
                }
            } finally {
                if (_didIteratorError) {
                    throw _iteratorError;
                }
            }
        }

        return resumed;
    });
};