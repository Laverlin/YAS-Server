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
    console.log("get request for " + userId);
    let dbMongo = new DbMongo(connectionString);
    dbMongo.GetRouteListByUserId(userId)
        .then(routeList => {
            if (routeList == null || routeList.length == 0) {
                response.sendStatus(991);
            }
            else {
                response.send(routeList);
            }
        });
 });

restServer.listen(port, () => console.log(`Listening on port ${port}`));
