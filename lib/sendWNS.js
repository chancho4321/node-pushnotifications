'use strict';

function _toConsumableArray(arr) { if (Array.isArray(arr)) { for (var i = 0, arr2 = Array(arr.length); i < arr.length; i++) { arr2[i] = arr[i]; } return arr2; } else { return Array.from(arr); } }

var wns = require('wns');

var method = 'wns';
var resumed = void 0;

function processResponse(err, response, regId) {
    resumed.success += err || response.innerError ? 0 : 1;
    resumed.failure += err || response.innerError ? 1 : 0;
    resumed.message.push({
        regId: regId,
        error: err || (response.innerError ? new Error(response.innerError) : null)
    });
}

module.exports = function (_regIds, _data, settings) {
    // sendNotifications and sendPromises are inside exports as in this way,
    // successive calls to this module doesn't override previous ones
    var sendPromises = void 0;

    function sendNotifications(regIds, notificationMethod, data, opts, onFinish) {
        var regId = regIds.shift();
        if (regId) {
            try {
                wns[notificationMethod](regId, data, opts, function (err, response) {
                    sendPromises.push(Promise.resolve());
                    processResponse(err, response, regId);
                    sendNotifications(regIds, notificationMethod, data, Object.assign({}, opts, {
                        accessToken: response.newAccessToken
                    }), onFinish);
                });
            } catch (err) {
                sendPromises.push(Promise.reject(err));
                sendNotifications(regIds, notificationMethod, data, opts, onFinish);
            }
        } else {
            Promise.all(sendPromises).then(function () {
                return onFinish();
            }, onFinish);
        }
    }

    var promises = [];
    var notificationMethod = settings.wns.notificationMethod;
    var opts = Object.assign({}, settings.wns);
    var data = Object.assign({}, _data);

    resumed = {
        method: method,
        success: 0,
        failure: 0,
        message: []
    };
    opts.headers = data.headers || opts.headers;
    opts.launch = data.launch || opts.launch;
    opts.duration = data.duration || opts.duration;

    delete opts.notificationMethod;
    delete data.headers;
    delete data.launch;
    delete data.duration;

    if (opts.accessToken) {
        (function () {
            sendPromises = [];
            var regIds = [].concat(_toConsumableArray(_regIds));
            promises.push(new Promise(function (resolve, reject) {
                return sendNotifications(regIds, notificationMethod, data, opts, function (err) {
                    return err ? reject(err) : resolve();
                });
            }));
        })();
    } else {
        _regIds.forEach(function (regId) {
            return promises.push(new Promise(function (resolve) {
                return wns[notificationMethod](regId, data, opts, function (err, response) {
                    processResponse(err, response, regId);
                    resolve();
                });
            }));
        });
    }

    return Promise.all(promises).then(function () {
        return resumed;
    });
};