/**
 * Created by Rajinda on 9/18/2016.
 */

var config = require('config');
var redisHandler = require('./RedisHandler.js');
var messageFormatter = require('dvp-common/CommonMessageGenerator/ClientMessageJsonFormatter.js');

var activeCallList = [];
var companyList = [];

var CreateOnGoingCallList = function (reqId, setId, callback) {
    var arr = {};
    try {
        redisHandler.GetFromSet(reqId, setId, function (err, callList) {
            if (err) {
                callback(err, arr);
            }
            else {
                var current = 0;
                var count = callList.length;


                if (count) {
                    for (i = 0; i < callList.length; i++) {
                        //HMGET

                        redisHandler.GetFromHash(reqId, callList[i], function (err, hash) {
                            if (hash) {
                                var key = hash['Caller-Unique-ID'];
                                arr[key] = hash;
                            }
                            if (current <= count) {
                                current++;

                                if (current >= count) {
                                    callback(undefined, arr);
                                }
                            }
                            else {
                                callback(undefined, arr);
                            }
                        });
                    }
                }
                else {
                    callback(null, arr);
                }

            }
        })
    }
    catch (ex) {
        callback(ex, arr);

    }
};


var getCallList = function (tenantId, companyId) {

    var setKey = "CHANNELS:" + tenantId + ":" + companyId;

    CreateOnGoingCallList(companyId, setKey, function (err, hashList) {
        var calls = {};

        var usedChanList = {};
        var otherLegChanList = {};

        for (var key in hashList) {
            if (!usedChanList[key]) {
                var callChannels = [];
                var otherLegUuid = hashList[key]['Other-Leg-Unique-ID'];
                if (!otherLegUuid) {
                    //

                    var otherlegKey = otherLegChanList[key];

                    if (otherlegKey) {
                        calls[otherlegKey].push(hashList[key]);
                        usedChanList[key] = key;
                    }
                    else {
                        callChannels.push(hashList[key]);

                        usedChanList[key] = key;

                        calls[key] = callChannels;
                    }

                    //

                }
                else {

                    if (usedChanList[otherLegUuid]) {
                        var chanListId = usedChanList[otherLegUuid];

                        calls[chanListId].push(hashList[key]);

                        usedChanList[key] = chanListId;

                        if (!otherLegChanList[otherLegUuid]) {
                            otherLegChanList[otherLegUuid] = key;
                        }

                    }
                    else {
                        if (otherLegChanList[otherLegUuid]) {
                            var chanListId = otherLegChanList[otherLegUuid];
                            calls[chanListId].push(hashList[key]);
                        }
                        else {
                            callChannels.push(hashList[key]);
                            usedChanList[key] = key;
                            otherLegChanList[otherLegUuid] = key;
                            calls[key] = callChannels;
                        }

                    }
                }
            }

        }
        activeCallList[companyId] = [];
        activeCallList[companyId] = calls;

    });
};

var initiateCallList = function (tenantId, companyId) {

    var interval = config.timerSetting.timeInterval || 1000;

    setInterval(function () {
        companyList.forEach(function (obj) {
            getCallList(obj.tenantId, obj.companyId);
        });
    }, interval);
    getCallList(tenantId, companyId);
};

module.exports.GetActiveCalls = function (tenantId, companyId) {
    var id = companyId;
    var data = {
        "tenantId": tenantId,
        "companyId": companyId,
        "key": id
    };
    if (companyList.length === 0) {
        companyList[id] = data;
        initiateCallList(tenantId, companyId)
    }
    companyList[id] = data;

    return activeCallList[companyId];
};