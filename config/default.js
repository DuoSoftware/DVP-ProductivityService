module.exports = {
    "DB": {
        "Type": "postgres",
        "User": "duo",
        "Password": "DuoS123",
        "Port": 5432,
        "Host": "104.236.231.11",//104.131.105.222
        "Database": "duo" //duo
    },
    "Redis": {
        "ip": "45.55.142.207",
        "port": 6389,
        "password": "DuoS123",
        "redisdb": 6,
        "ardsData": 8,

        "redisip": "45.55.142.207",
        "redisport": 6389

    },

    "Security": {
        "ip": "45.55.142.207",
        "port": 6389,
        "user": "DuoS123",
        "password": "DuoS123"

    },

    "Host": {
        "domain": "0.0.0.0",
        "port": 8832,
        "version": "1.0.0.0",
        "hostpath": "./config",
        "logfilepath": ""
    },
    "timerSetting": {
        "timeInterval": 1000,
        "timeIntervalDbCall": 1000,
        "timeIntervalArds": 1000
    },
    "urls": {
        "resourceServiceBaseUrl": "http://localhost:8832/DVP/API/1.0.0.0/ResourceManager/Resources/Productivity"
    }
};