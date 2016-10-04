/**
 * Created by Rajinda on 9/18/2016.
 */

var agentHandler = require('./AgentHandler');
var attributesHandler = require('../Attributes/AttributesHandler');
var format = require('stringformat');
var config = require('config');
var redis = require('redis');
var redisip = config.Redis.ip;
var redisport = config.Redis.port;
var redisClient = redis.createClient(redisport, redisip);
var redisardsClient = redis.createClient(redisport, redisip);
var messageFormatter = require('dvp-common/CommonMessageGenerator/ClientMessageJsonFormatter.js');
var logger = require('dvp-common/LogHandler/CommonLogHandler.js').logger;
/*var format = require('string-format');*/
var moment = require('moment');


redisClient.auth(config.Redis.password, function (err) {
    /*if (err)
     throw err;*/
    console.log("Redis Auth error  " + err);
});

redisClient.on("error", function (err) {
    console.log("Redis connection error  " + err);
});

redisClient.on("connect", function (err) {
    redisClient.select(config.Redis.ardsData, redis.print);
});

//**** ards data con
redisardsClient.auth(config.Redis.password, function (err) {
    /*if (err)
     throw err;*/
    console.log("Redis[ARDS] Auth error  " + err);
});

redisardsClient.on("error", function (err) {
    console.log("Redis[ARDS] connection error  " + err);
});

redisardsClient.on("connect", function (err) {
    redisardsClient.select(config.Redis.redisdb, redis.print);
});


var agentProductivitys = [];
var companyList = [];
var agentIdList = new Array();

/*var agentProductivitys = [{
 "id": 0, "agentProductivity": {
 "data": [{
 value: "",
 name: 'After work'
 }],
 "ResourceId": 0,
 "ResourceName": "",
 "IncomingCallCount": 0,
 "MissCallCount": 0,
 "Chatid": 0,
 "AcwTime": 0,
 "BreakTime": 0,
 "HoldTime": 0,
 "OnCallTime": 0,
 "IdleTime": 0,
 "StaffedTime": 0,
 "slotState": {},
 "other": "",
 "LastReservedTime": "",
 "slotStateTime": "",
 "taskList": [],
 "callInfos": []
 }
 }];*/

function toSeconds(time) {
    var sTime = time.split(':'); // split it at the colons
    // minutes are worth 60 seconds. Hours are worth 60 minutes.
    return (+sTime[0]) * 60 * 60 + (+sTime[1]) * 60 + (+sTime[2]);
}


var initiateAgentProductivity = function (tenantId, companyId) {

    try {
        agentIdList = agentHandler.GetAgentIdList(tenantId, companyId);
        var agentDetails = attributesHandler.GetAgentDetails(tenantId, companyId);
        agentIdList.forEach(function (resId) {

            var resourceId = resId.split(":")[3];
            var agentProductivity = {
                "data": [{
                    value: 0,
                    name: 'After work'
                }, {
                    value: 0,
                    name: 'Break'
                }, {
                    value: 0,
                    name: 'On Call'
                }, {
                    value: 0,
                    name: 'Idle'
                }],
                "ResourceId": resourceId,
                "ResourceName": "",
                "IncomingCallCount": 0,
                "MissCallCount": 0,
                "Chatid": resourceId,
                "AcwTime": 0,
                "BreakTime": 0,
                "HoldTime": 0,
                "OnCallTime": 0,
                "IdleTime": 0,
                "StaffedTime": 0,
                "slotState": {},
                "other": "",
                "LastReservedTime": "",
                "slotStateTime": "",
                "taskList": [],
                "callInfos": []
            };


            if (!agentProductivitys[resourceId]) {
                agentProductivitys[resourceId] = agentProductivity;
            }
            if (agentDetails) {
                var agent = agentDetails[resourceId];
                if (agent) {
                    agentProductivitys[resourceId].taskList = agent.taskList;
                    agentProductivitys[resourceId].slotState = agent.slotState;
                    agentProductivitys[resourceId].other = agent.ConcurrencyInfo.other;
                    agentProductivitys[resourceId].LastReservedTime = agent.LastReservedTime;
                    agentProductivitys[resourceId].callInfos = agent.callInfos;
                    agentProductivitys[resourceId].ResourceName = agent.ResourceName;
                }
            }

        });

        /*agentProductivitys = agentProductivitys.filter(function (entry1) {
         return agentIdList.some(function (entry2) {
         return entry1.ResourceId === entry2.split(":")[3];
         })
         });*/
    }
    catch (err) {
        logger.error('initiateAgentProductivity', err);
    }
};

var getCurrentState = function (companyId, tenantId, resourceId) {
    var a = {};
    a.ids = {};
    a.ids.resourceId = resourceId;
    try {


        var currentState = format("ResourceState:{0}:{1}:{2}", companyId, tenantId, a.ids.resourceId);
        redisardsClient.get(currentState, function (err, currentObj) {
            if (err) {
                logger.error('[getCurrentState] - [%s]', a.ids.resourceId, err);
            }
            else {
                var sTime = JSON.parse(currentObj);
                agentProductivitys[a.ids.resourceId].slotStateTime =moment.utc(moment(moment(), "DD/MM/YYYY HH:mm:ss").diff(moment(sTime.StateChangeTime))).format("HH:mm:ss");
            }
        });
    } catch (err) {
        logger.error('[getCurrentState] - [%s]', a.ids.resourceId, err);
    }
};

var getCallAcwBreakIncomingCount = function (companyId, tenantId, resourceId) {
    var a = {};
    a.ids = {};
    a.ids.resourceId = resourceId;
    try {


        var callTime = format("TOTALTIME:{0}:{1}:CONNECTED:{2}:param2", tenantId, companyId, a.ids.resourceId);
        var acw = format("TOTALTIME:{0}:{1}:AFTERWORK:{2}:param2", tenantId, companyId, a.ids.resourceId);
        var breakTime = format("TOTALTIME:{0}:{1}:BREAK:{2}:param2", tenantId, companyId, a.ids.resourceId);
        var incomingCallCount = format("TOTALCOUNT:{0}:{1}:CONNECTED:{2}:param2", tenantId, companyId, a.ids.resourceId);

        var keys = [callTime, acw, breakTime, incomingCallCount];
        redisClient.mget(keys, function (err, reuslt) {
            if (err) {
                logger.error('[getCallAcwBreakIncomingCount] - [%s]', resourceId, err);
            }
            else {
                agentProductivitys[a.ids.resourceId].OnCallTime = reuslt[0] ? reuslt[0] : 0;
                agentProductivitys[a.ids.resourceId].AcwTime = reuslt[1] ? reuslt[1] : 0;
                agentProductivitys[a.ids.resourceId].BreakTime = reuslt[2] ? reuslt[2] : 0;
                agentProductivitys[a.ids.resourceId].IncomingCallCount = reuslt[3] ? reuslt[3] : 0;
                agentProductivitys[a.ids.resourceId].data = [{
                    value: reuslt[1] ? reuslt[1] : 0,
                    name: 'After work'
                }, {
                    value:  reuslt[2] ? reuslt[2] : 0,
                    name: 'Break'
                }, {
                    value: reuslt[0] ? reuslt[0] : 0,
                    name: 'On Call'
                }, {
                    value: agentProductivitys[a.ids.resourceId].idle,
                    name: 'Idle'
                }];

            }
        });
    } catch (err) {
        logger.error('[getCallAcwBreakIncomingCount] - [%s]', a.ids.resourceId, err);
    }
};

var getMiscallCount = function (companyId, tenantId, resourceId) {
    var a = {};
    a.ids = {};
    a.ids.resourceId = resourceId;
    try {


        var missCallCount = format("TOTALCOUNT:{0}:{1}:AGENTREJECT:*:{2}", tenantId, companyId, resourceId);
        redisClient.keys(missCallCount, function (err, ids) {
            if (err) {
                logger.error('[getMiscallCount] - [%s]', a.ids.resourceId, err);
            }
            else {
                if (ids && ids.length > 0) {
                    redisClient.mget(ids, function (err, misscalls) {
                        try {
                            agentProductivitys[a.ids.resourceId].MissCallCount = 0;
                            if (misscalls) {
                                agentProductivitys[a.ids.resourceId].MissCallCount = misscalls.reduce(function (pv, cv) {
                                    return parseInt(pv) + parseInt(cv);
                                }, 0);
                            }

                        } catch (ex) {
                            logger.error('[getMiscallCount step1] - [%s]', a.ids.resourceId, err);
                        }
                    });
                }
            }
        });
    } catch (err) {
        logger.error('[getMiscallCount] - [%s]', a.ids.resourceId, err);
    }
};

var getStaffedTime = function (companyId, tenantId, resourceId) {
    var a = {};
    a.ids = {};
    a.ids.resourceId = resourceId;
    try {


        var staffedTimeKey = format("SESSION:{0}:{1}:LOGIN:{2}:{2}:param2", tenantId, companyId, a.ids.resourceId);
        var staffedTimeLastDay = format("TOTALTIME:{0}:{1}:LOGIN:{2}:param2", tenantId, companyId, a.ids.resourceId);
        redisClient.hget(staffedTimeKey, "time", function (err, reuslt) {
            if (err) {
                logger.error('[getStaffedTime] - [%s]', a.ids.resourceId, err);
            }
            else {
                try {

                    if (reuslt) {

                        var stfTime = moment.utc(moment(moment(), "DD/MM/YYYY HH:mm:ss").diff(moment(moment(reuslt), "DD/MM/YYYY HH:mm:ss"))).format("HH:mm:ss"); // split it at the colons
                        var staffedTimeToday = toSeconds(stfTime);
                        var workTime = 0;
                        try {

                            workTime = parseInt(agentProductivitys[a.ids.resourceId].OnCallTime) + parseInt(agentProductivitys[a.ids.resourceId].AcwTime) + parseInt(agentProductivitys[a.ids.resourceId].BreakTime);

                        }
                        catch (ex) {
                            logger.error('[getStaffedTime step1] - [%s]', a.ids.resourceId, err);
                        }
                        try {
                            redisClient.get(staffedTimeLastDay, function (err, reuslt) {
                                if (err) {
                                    console.log(err);
                                }
                                else {
                                    if (reuslt) {
                                        try {
                                            agentProductivitys[a.ids.resourceId].StaffedTime = parseInt(reuslt) + parseInt(staffedTimeToday);
                                        }
                                        catch (ex) {
                                            logger.error('[getStaffedTime step2] - [%s]', a.ids.resourceId, err);
                                        }
                                    }
                                    else{
                                        agentProductivitys[a.ids.resourceId].StaffedTime = parseInt(stfTime);
                                    }
                                    var idlTime = parseInt(agentProductivitys[a.ids.resourceId].StaffedTime) - parseInt(workTime);
                                    agentProductivitys[a.ids.resourceId].IdleTime = idlTime;
                                    agentProductivitys[a.ids.resourceId].data = [{
                                        value: agentProductivitys[a.ids.resourceId].AcwTime,
                                        name: 'After work'
                                    }, {
                                        value:  agentProductivitys[a.ids.resourceId].BreakTime,
                                        name: 'Break'
                                    }, {
                                        value: agentProductivitys[a.ids.resourceId].OnCallTime,
                                        name: 'On Call'
                                    }, {
                                        value: idlTime,
                                        name: 'Idle'
                                    }];
                                }
                            });
                        } catch (ex) {
                            console.log(err);
                        }
                    }
                    else {
                        agentProductivitys[a.ids.resourceId].StaffedTime = 0;
                        agentProductivitys[a.ids.resourceId].IdleTime = 0;
                    }
                } catch (ex) {
                    logger.error('[getStaffedTime] - [%s]', a.ids.resourceId, err);
                }


            }
        });
    } catch (err) {
        logger.error('[getStaffedTime] - [%s]', a.ids.resourceId, err);
    }
};

var setAttribute = function (resourceId) {
    var a = {};
    a.ids = {};
    a.ids.resourceId = resourceId;
    try {

    }
    catch (err) {
        logger.error('[setAttribute] - [%s]', a.ids.resourceId, err);
    }
};

var calculateProductivity = function (companyId, tenantId) {
    var interval = config.timerSetting.timeInterval || 1000;

    setInterval(function () {
        companyList.forEach(function(item){
            initiateAgentProductivity(item.tenantId, item.companyId);
        });
    }, interval);

    setInterval(function () {
        agentIdList.forEach(function (resId) {
            companyList.forEach(function(item){
            var resourceId = resId.split(":")[3];
            getCurrentState(item.companyId, item.tenantId, resourceId);
            getCallAcwBreakIncomingCount(item.companyId, item.tenantId, resourceId);
            getMiscallCount(item.companyId, item.tenantId, resourceId);
            getStaffedTime(item.companyId, item.tenantId, resourceId);});
        });
    }, interval + 200);

    setInterval(function () {
        removeOldItems();
    }, interval);
};

var removeOldItems = function () {
    try {
        agentProductivitys.forEach(function (entry1) {
            if (!agentIdList.some(function (entry2) {
                    return entry1.ResourceId === entry2.split(":")[3];
                })) {
                delete agentProductivitys[entry1.ResourceId];
            }
        });
    }
    catch (err) {
        logger.error('[removeOldItems] ', err);
    }
};

module.exports.GetAgentsProductivity = function (req, res, companyId, tenantId) {
    var id = companyId;
    var data = {
        "tenantId": tenantId,
        "companyId": companyId,
        "key": id
    };
    if (companyList.length === 0) {
        companyList[id] = data;
        calculateProductivity(companyId, tenantId);
    }



    var result = agentProductivitys.filter(function (entry1) {
        return agentIdList.some(function (entry2) {
            return entry1.ResourceId === entry2.split(":")[3];
        })
    });

    var jsonString = messageFormatter.FormatMessage(undefined, "SUCCESS", true, result);
    logger.info('[Productivity] . [%s] -[%s]', result, jsonString);
    res.end(jsonString);
};