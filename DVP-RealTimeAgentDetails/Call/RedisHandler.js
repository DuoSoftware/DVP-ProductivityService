var redis = require("redis");
var Config = require('config');
var logger = require('dvp-common/LogHandler/CommonLogHandler.js').logger;

var redisIp = Config.Redis.ip;
var redisPort = Config.Redis.port;
var redisPassword = Config.Redis.password;

var client = redis.createClient(redisPort, redisIp);

client.auth(redisPassword, function (redisResp) {
    console.log("Redis Auth Response : " + redisResp);
});

var SetObject = function(reqId, key, value, callback)
{
    try
    {

        client.set(key, value, function(err, response)
        {
            callback(err, response);
        });

    }
    catch(ex)
    {
        logger.error('[DVP-MonitorRestAPI.SetObject] - [%s] - Exception occurred', reqId, ex);
        callback(ex, undefined);
    }

};

var GetObject = function(reqId, key, callback)
{
    try
    {

        client.get(key, function(err, response)
        {

            callback(err, response);
        });

    }
    catch(ex)
    {
        logger.error('[DVP-MonitorRestAPI.GetObject] - [%s] - Exception occurred', reqId, ex);
        callback(ex, undefined);
    }
};

var PublishToRedis = function(reqId, pattern, message, callback)
{
    try
    {
       if(client.connected)
        {
            var result = client.publish(pattern, message);

        }
        callback(undefined, true);

    }
    catch(ex)
    {
        logger.error('[DVP-MonitorRestAPI.PublishToRedis] - [%s] - Exception occurred', reqId, ex);
        callback(ex, false);
    }
};

var GetFromSet = function(reqId, setName, callback)
{
    try
    {
         if(client.connected)
        {
            client.smembers(setName, function (err, setValues)
            {
                 callback(err, setValues);
            });
        }
        else
        {
            callback(new Error('Redis Client Disconnected'), undefined);
        }


    }
    catch(ex)
    {
        logger.error('[DVP-MonitorRestAPI.GetFromSet] - [%s] - Exception occurred', reqId, ex);
        callback(ex, undefined);
    }
};

var GetFromHash = function(reqId, hashName, callback)
{
    try
    {
        if(client.connected)
        {
            client.hgetall(hashName, function (err, hashObj)
            {

                callback(err, hashObj);
            });
        }
        else
        {
            callback(new Error('Redis Client Disconnected'), undefined);
        }
    }
    catch(ex)
    {
        logger.error('[DVP-MonitorRestAPI.GetFromHash] - [%s] - Exception occurred', reqId, ex);
        callback(ex, undefined);
    }
};



var MGetObjects = function(reqId, keyArr, callback)
{
    try
    {
        client.mget(keyArr, function(err, response)
        {

            callback(err, response);
        });

    }
    catch(ex)
    {
        logger.error('[DVP-MonitorRestAPI.HMGetObjects] - [%s] - Exception occurred', reqId, ex);
        callback(ex, undefined);
    }
};

var GetKeys = function(reqId, pattern, callback)
{
    if(client.connected)
    {
        client.keys(pattern, function (err, keyArr)
        {

            callback(err, keyArr);
        });
    }
    else
    {
        callback(new Error('Redis Client Disconnected'), undefined);
    }
};

client.on('error', function(msg)
{
    logger.error('[DVP-MonitorRestAPI.a] - [%s] - Exception occurred', msg);
});

module.exports.SetObject = SetObject;
module.exports.PublishToRedis = PublishToRedis;
module.exports.GetFromSet = GetFromSet;
module.exports.GetFromHash = GetFromHash;
module.exports.GetObject = GetObject;
module.exports.GetKeys = GetKeys;
module.exports.MGetObjects = MGetObjects;
