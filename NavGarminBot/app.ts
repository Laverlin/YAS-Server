import TelegramBot = require('node-telegram-bot-api');
import request = require('request');
import xml2js = require('xml2js');
import env = require('dotenv');
import express = require('express');

import { UserInfo } from "./UserInfo";
import { Route } from "./Route";
import { WayPoint } from "./Route";
import { isNullOrUndefined } from 'util';
import { DbMongo } from './DbMongo';

// Constants
//
let conf = env.config();
const TELEGRAM_TOKEN = process.env.TELEGRAM_API_KEY;
const MONGO_VARIABLE = 'MONGO_PORT_27017_TCP_ADDR'
const MONGO_DEFAULT_SERVER = 'localhost'

// Init
//
let telegramBot = new TelegramBot(TELEGRAM_TOKEN, { polling: true });
let connectionString: string = `mongodb://${process.env[MONGO_VARIABLE] || MONGO_DEFAULT_SERVER}:27017/`;

// Extracts UserInfo from TelegramBot.Message class
//
function ExtractUser(inMessage: TelegramBot.Message): UserInfo {
    let userName = inMessage.from.username ? `(${inMessage.from.username})` : '';
    let userInfo = new UserInfo(inMessage.from.id, `${inMessage.from.first_name} ${inMessage.from.last_name} ${userName}`);
    return userInfo;
}

telegramBot.onText(/Download it:([^;]+)/i, (inMessage, match) => {

    let parser = new xml2js.Parser();
    let outMessage = '';

    request(match[1], function (error, response, body) {
        if (response.statusCode != 200) {
            outMessage = `unable to get data from ${match[1]}\n status: ${response.statusCode}, ${error}`;
            telegramBot.sendMessage(inMessage.chat.id, outMessage);
            console.log('request error:', error); 
            console.log('statusCode:', response && response.statusCode); 
            return;
        }

        parser.parseString(body, function (error, result) {
            if (!isNullOrUndefined(error)) {
                outMessage = `unable to parse response from ${match[1]}\n error: ${error}`;
                telegramBot.sendMessage(inMessage.chat.id, outMessage);
                console.log('parsing error:', error);
                console.log('response body:', body);
                return;
            }

            try {
                let route = new Route('Route');
                let placemarks = result['kml']['Document'][0]['Placemark'];
                for (let i = 0; i < placemarks.length; i++)
                    if (placemarks[i]['styleUrl'] != '#RouteStyle') {
                        let points = placemarks[i]['Point'][0]['coordinates'][0].split(',');
                        let wayPoint = new WayPoint(placemarks[i]['name'][0], points[1], points[0]);
                        route.WayPoints.push(wayPoint);
                        console.log(wayPoint);
                    }

                //route.RouteName += `${route.WayPoints[0].PointName} `;
                let dbMongo = new DbMongo(connectionString);
                dbMongo.AddRoute(route, inMessage.from.id)
                    .then(userId => {
                        outMessage = `Route ${route.RouteName} (${route.WayPoints.length} way points) has been upload \n userId:${userId}`;
                        telegramBot.sendMessage(inMessage.chat.id, outMessage);
                    });

                console.log(route);
            }
            catch(error){
                outMessage = `unable to process response from ${match[1]}\n error: ${error}`;
                telegramBot.sendMessage(inMessage.chat.id, outMessage);
                console.log('process error: ', error);
            }
        });
    });
});

// Log incoming requests
//
telegramBot.on("text", (message) => {
    let userInfo = ExtractUser(message);
    let logMessage = ` chatId : ${message.chat.id}\n from : [${userInfo.UserId}] ${userInfo.UserName}\n message : ${message.text}`;
    console.log(logMessage);
});


const restServer = express();
const port = 3000;
const router = express.Router();

restServer.use('/garminapi', router);
router.get('/routelist/:userid', (request, response) => {
    let userId: string = request.params.userid;
    console.log("get request for " + userId);
    let dbMongo = new DbMongo(connectionString);
    dbMongo.GetRouteList(userId)
        .then(routeList => response.send(routeList));
 });

restServer.listen(port, () => console.log(`Listening on port ${port}`));
