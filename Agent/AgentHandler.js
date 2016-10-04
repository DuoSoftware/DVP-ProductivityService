/**
 * Created by Rajinda on 9/18/2016.
 */

var format = require('stringformat');
var config = require('config');
var redis = require('redis');
var redisip = config.Redis.ip;
var redisport = config.Redis.port;
var redisardsClient = redis.createClient(redisport, redisip);
var logger = require('dvp-common/LogHandler/CommonLogHandler.js').logger;

//**** ards data con
redisardsClient.auth(config.Redis.password, function (err) {
    console.log("Redis[ARDS] Auth error  " + err);
});

redisardsClient.on("error", function (err) {
    console.log("Redis[ARDS] connection error  " + err);
});

redisardsClient.on("connect", function (err) {
    redisardsClient.select(config.Redis.redisdb, redis.print);
});


var agentIdList = [];

var getAgentList = function(tenantId,companyId){
    var interval = config.timerSetting.timeInterval || 3000;
    var id = format("Resource:{0}:{1}:*", companyId, tenantId);
    setInterval(function() {
        try {
            redisardsClient.keys(id, function (err, resourceIds) {
                if (err) {
                    logger.error('[getAgentList] - [%s]', id, err);
                }
                else {
                    agentIdList = resourceIds;
                }
            });
        }
        catch (err) {
            logger.error('getAgentList', err);
        }

    }, interval);
};

module.exports.GetAgentIdList = function (tenantId,companyId) {
    if(agentIdList.length===0){
        getAgentList(tenantId,companyId)
    }
    return agentIdList;
};