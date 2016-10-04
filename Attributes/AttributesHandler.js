/**
 * Created by Rajinda on 9/18/2016.
 */
var request = require('request');
var config = require('config');
var logger = require('dvp-common/LogHandler/CommonLogHandler.js').logger;
var resourceHandler = require('dvp-ardscommon/ResourceHandler.js');
var resourceMonitor = require('./ResourceMonitor');
var realTImeCallHandler = require('../Call/realTImeCallHandler');
var redisHandler = require('dvp-ardscommon/RedisHandler.js');
var DbConn = require('dvp-dbmodels');
var util = require('util');
require('array.prototype.find');
var moment = require('moment');


var attributeList = new Array();
var profiles = new Array();
var agentAttributeList = [];
var companyList = [];

var loadProfileList = function (tenantId, companyId) {

    try {
        var searchTags = ["company_" + companyId, "tenant_" + tenantId];
        var logkey = 123;
        resourceMonitor.GetAllResources(logkey, companyId, tenantId, function (err, res) {
            var key = companyId;
            var obj = res;
            profiles[key] = [];
            profiles[key] = obj;
        });
    }
    catch (err) {
        logger.error('[loadProfileList] ', err);
    }
};

var loadAttributesList = function (tenantId, companyId) {

    DbConn.ResAttribute.findAll({
        where: [{Status: true}, {TenantId: tenantId}, {CompanyId: companyId}],
        order: [['AttributeId', 'DESC']]
    }).then(function (CamObject) {
        if (CamObject) {
            var key = companyId;
            attributeList[key] = CamObject;
        }
        else {
            logger.error('[DVP-ResAttribute.GetAllAttributes] - [PGSQL]  - No record found for %s - %s  ', tenantId, companyId);
        }
    }).error(function (err) {
        logger.error('[DVP-ResAttribute.GetAllAttributes] - [%s] - [%s] - [PGSQL]  - Error in searching.-[%s]', tenantId, companyId, err);
    });
};


var setAgentTask = function (key, tenantId, companyId) {

    try {

        if (profiles[key])
            profiles[key].forEach(function (agent) {
                try {
                    if (agent) {
                        var tasks = [];
                        var id = parseInt(agent.ResourceId);

                        if (!agentAttributeList[id]) {
                            var data = {
                                "ResourceName": agent.ResourceName,
                                "taskList": [],
                                "ConcurrencyInfo": {
                                    "slotState": "",
                                    "other": "",
                                    "LastReservedTime": "",
                                    "slotStateTime": "",
                                    "sessionIds": []
                                },
                                "ResourceDetails": {
                                    "ConcurrencyData": [],
                                    "Status": {}
                                }
                            };
                            agentAttributeList[id] = data;
                        }

                        /*Set Task Informations*/
                        agent.ResourceAttributeInfo.forEach(function (item) {
                            try {

                                var att = attributeList[key].find(function (a) {
                                    return a.AttributeId === parseInt(item.Attribute);
                                });

                                if (att) {
                                    var task = {};
                                    task.taskType = item.HandlingType;
                                    task.percentage = item.Percentage;
                                    task.skill = att.Attribute;
                                    tasks.push(task);
                                }

                            }
                            catch (err) {
                                logger.error('[setAgentTask] step1- [%s]', agent, err);
                            }
                        });
                        agentAttributeList[id].taskList = tasks;

                        /*set Resource Details*/
                        agentAttributeList[id].ResourceDetails = {
                            "ConcurrencyData": agent.ConcurrencyInfo,
                            "Status": agent.Status,
                            "TaskStatus":[]
                        };

                        /*set ConcurrencyInfo*/
                        var slotState = agent.Status.State;
                        var slotChngReason = agent.Status.Reason;
                        agentAttributeList[id].slotState = slotState;
                        agentAttributeList[id].LastReservedTime = agent.Status.StateChangeTime;
                        agentAttributeList[id].slotStateTime = agent.Status.StateChangeTime;

                        if (slotState == "NotAvailable") {
                            agentAttributeList[id].slotState = slotChngReason;
                            agentAttributeList[id].other = "Break";
                        }

                        var sessionIds = [];
                        var callInfo = [];
                        var callList = realTImeCallHandler.GetActiveCalls(tenantId, companyId);
                        agent.ConcurrencyInfo.forEach(function (item) {
                            try {
                                if(item.SlotInfo) {
                                    /*set Active Call*/
                                    var slotInfo = item.SlotInfo.find(function (a) {
                                        return a.State === "Connected" && a.HandlingType === "CALL";
                                    });
                                    if (slotInfo) {
                                        var sid = slotInfo.HandlingRequest;
                                        sessionIds.push(sid);

                                        for (var prop in callList) {
                                            if (callList.hasOwnProperty(prop)) {
                                                callList[prop].forEach(function (a) {
                                                    if (a['Unique-ID'] === sid) {
                                                        var data = {
                                                            "CallDirection": a['Call-Direction'],
                                                            "Number": a['Call-Direction'] === "inbound" ? a['Caller-Caller-ID-Number'] : a['Caller-Destination-Number'],
                                                            "UniqueID": a['Unique-ID']
                                                        };
                                                        callInfo.push(data);
                                                    }
                                                });
                                            }
                                        }
                                        agentAttributeList[id].callInfos = callInfo;
                                    }
                                    else {
                                        agentAttributeList[id].callInfos = [];
                                    }
                                    /*set Active Call -End*/


                                    item.SlotInfo.forEach(function (s) {
                                        if (s.LastReservedTime > agentAttributeList[id].LastReservedTime) {
                                            agentAttributeList[id].LastReservedTime = s.LastConnectedTime;
                                        }
                                    });
                                }

                                agentAttributeList[id].ResourceDetails.TaskStatus.push({
                                    "HandlingType" : item.HandlingType,
                                    "IsRejectCountExceeded" : item.IsRejectCountExceeded
                                });
                                if(item.IsRejectCountExceeded){
                                    agentAttributeList[id].slotState = "Suspended";
                                    agentAttributeList[id].other = "Reject";
                                }
                            }
                            catch (err) {
                                logger.error('[ConcurrencyInfo] - [%s]', item, err);
                            }
                        });
                        agentAttributeList[id].ConcurrencyInfo.sessionIds = sessionIds;

                        logger.info('[Agent Details ] - [%s]/n', JSON.stringify(agent));
                        logger.info('-------------------------------------------------');

                    }
                } catch (err) {
                    logger.error('[setAgentTask] - [%s]', agent, err);
                }
            });
    }
    catch (err) {
        logger.error('[setAgentTask] ', err);
    }

};


var initiateAgentDetails = function (tenantId, companyId) {

    var interval = config.timerSetting.timeIntervalDbCall || 1000;
    var intervalards = config.timerSetting.timeIntervalArds || 1000;

    setInterval(function () {
        companyList.forEach(function (obj) {
            loadProfileList(obj.tenantId, obj.companyId);
            setAgentTask(obj.key, obj.tenantId, obj.companyId);
        });
    }, intervalards);

    setInterval(function () {
        companyList.forEach(function (obj) {
            loadAttributesList(obj.tenantId, obj.companyId);
        });
    }, interval);

    loadProfileList(tenantId, companyId);
    loadAttributesList(tenantId, companyId);
    setAgentTask(companyId);
};

module.exports.GetAgentDetails = function (tenantId, companyId) {

    var id = companyId;
    var data = {
        "tenantId": tenantId,
        "companyId": companyId,
        "key": id
    };
    if (companyList.length === 0) {
        companyList[id] = data;
        initiateAgentDetails(tenantId, companyId)
    }
    companyList[id] = data;
    return agentAttributeList;
};

