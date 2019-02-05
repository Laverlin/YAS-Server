import env = require('dotenv');
import express = require('express');

import { Route } from "./Route";
import { isNullOrUndefined } from 'util';
import { DbMongo } from './DbMongo';
import { RunBot } from './YASNavGarminBot';

// Constants
//
let conf = env.config();
const TELEGRAM_TOKEN = process.env.TELEGRAM_API_KEY;
const MONGO_VARIABLE = 'MONGO_PORT_27017_TCP_ADDR'
const MONGO_DEFAULT_SERVER = 'localhost'

// Init
//
let connectionString: string = `mongodb://${process.env[MONGO_VARIABLE] || MONGO_DEFAULT_SERVER}:27017/`;

// Run Bot
//
RunBot(TELEGRAM_TOKEN, connectionString);

// Run Web API server
//
const restServer = express();
const port = 3000;
const router = express.Router();

restServer.use('/garminapi', router);

router.get('/routelist', (request, response) => {
    response.sendStatus(404);
});

router.get('/routelist/:userid', (request, response) => {
    let userId: string = request.params.userid;
    let ts = new Date();
    console.log(ts.toUTCString() + " watch request for " + userId);
    let dbMongo = new DbMongo(connectionString);
    dbMongo.GetRouteListByUserId(userId)
        .then(routeList => {
            response.send(routeList);
            if (!isNullOrUndefined(routeList))
                console.log(`\t ${routeList.length} routes sended`);
            else
                console.log(`\t there is no routes for this user id`);
        });
 });

let utcTime = (new Date()).toUTCString();
restServer.listen(port, () => console.log(`${utcTime} Listening on port ${port}`));
