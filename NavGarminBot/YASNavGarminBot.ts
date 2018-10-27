process.env["NTBA_FIX_319"] = "1";
import TelegramBot = require('node-telegram-bot-api');
import request = require('request-promise-native');
import xml2js = require('xml2js');

import { UserInfo } from "./UserInfo";
import { Route } from "./Route";
import { WayPoint } from "./Route";
import { isNullOrUndefined } from 'util';
import { DbMongo } from './DbMongo';

// Error handling
//
function processError(telegramBot: TelegramBot, chatId: number, url: string, error: string) {
    console.log('request error:', error);
    console.log('request url:', url);
    let outMessage = `unable to get data from ${url}\n error: ${error}`;
    telegramBot.sendMessage(chatId, outMessage);
}

// Extracts UserInfo from TelegramBot.Message class
//
function ExtractUser(inMessage: TelegramBot.Message): UserInfo {
    let userName = inMessage.from.username ? `(${inMessage.from.username})` : '';
    let userInfo = new UserInfo(inMessage.from.id, `${inMessage.from.first_name} ${inMessage.from.last_name} ${userName}`);
    return userInfo;
}

// Run bot and process user requests
//
export async function RunBot(telegramToken: string, connectionString: string) {

    let telegramBot = new TelegramBot(telegramToken, { polling: true });

    telegramBot.onText(/Start/i, async (inMessage, match) => {
        let outMessage = "/myid `- return user ID`\n\n/list `- route list `\n\n /rename <new name> `- rename last uploaded route`\n\n /rename:<id> <new name> `- rename route with <id>`\n\n /delete:<id> `delete route with <id>`";
        telegramBot.sendMessage(inMessage.chat.id, outMessage, { parse_mode: "Markdown" });
    })

    // Download route from Navionics
    //
    telegramBot.onText(/Download it:([^;]+)/i, async (inMessage, match) => {

        let response = request(match[1])
            .then(function (response) {

                let parser = new xml2js.Parser();
                parser.parseString(response, async function (error, result) {

                    if (!isNullOrUndefined(error)) {
                        processError(telegramBot, inMessage.chat.id, match[1], error);
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
                            }

                        let dbMongo = new DbMongo(connectionString);
                        let userId = await dbMongo.AddRoute(route, inMessage.from.id)
                        let outMessage = `${route.RouteName} (${route.WayPoints.length} way points) has been upload \n userId:${userId}`;
                        telegramBot.sendMessage(inMessage.chat.id, outMessage);
                        console.log(outMessage);

                    }
                    catch (error) {
                        processError(telegramBot, inMessage.chat.id, match[1], error);
                    }
                });
            })
            .catch(function (error) {
                processError(telegramBot, inMessage.chat.id, match[1], error.name + ", code:" + error.statusCode);
            });
    });

    // return list of routes
    //
    telegramBot.onText(/list/i, (inMessage, match) => {

        let dbMongo = new DbMongo(connectionString);
        dbMongo.GetRouteListByTeleId(inMessage.from.id)
            .then(routeList => {
                let outMessage = "";
                if (isNullOrUndefined(routeList) || routeList.length < 1) {
                    outMessage = "there is no routes here";
                }
                else {
                    for (let i = 0; i < routeList.length; i++) {
                        outMessage += "*" + routeList[i].RouteId + "* : `" + routeList[i].RouteName + "\n(" + routeList[i].RouteDate.toDateString() + ")`\n\n";
                    }
                }
                telegramBot.sendMessage(inMessage.chat.id, outMessage, { parse_mode: "Markdown"});
            });
    });

    // rename last uploaded route
    //
    telegramBot.onText(/Rename ([^;]+)/i, async (inMessage, match) => {

        let dbMongo = new DbMongo(connectionString);
        let result = await dbMongo.RenameRoute(inMessage.from.id, match[1]);
        let outMessage = "New name: " + match[1];
        if (!result)
            outMessage = "nothing to rename ";
        telegramBot.sendMessage(inMessage.chat.id, outMessage);
    });

    // rename appointed route
    //
    telegramBot.onText(/Rename:[0-9]+ ([^;]+)/i, async (inMessage, match) => {

        let outMessage = "";
        let routeId = /[0-9]+/i.exec(inMessage.text)[0];

        let dbMongo = new DbMongo(connectionString);
        let result = await dbMongo.RenameRoute(inMessage.from.id, match[1], routeId);
        if (result)
            outMessage = "route id: " + routeId + ", new name: " + match[1];
        else
            outMessage = "cannot find route id: " + routeId;
        telegramBot.sendMessage(inMessage.chat.id, outMessage);
    });

    // rename appointed route
    //
    telegramBot.onText(/delete:([0-9]+)/i, async (inMessage, match) => {

        let outMessage = "";
 
        let dbMongo = new DbMongo(connectionString);
        let result = await dbMongo.DeleteRoute(inMessage.from.id, match[1]);
        if (result)
            outMessage = "route id: " + match[1] + " has been deleted";
        else
            outMessage = "cannot find route id: " + match[1];
        telegramBot.sendMessage(inMessage.chat.id, outMessage);

    });

    telegramBot.onText(/myid/i, async (inMessage, match) => {
        let outMessage = "";

        let dbMongo = new DbMongo(connectionString);
        let result = await dbMongo.GetUserId(inMessage.from.id);
        outMessage = result;
        telegramBot.sendMessage(inMessage.chat.id, outMessage);

    })

    // Log incoming requests
    //
    telegramBot.on("text", (message) => {
        let userInfo = ExtractUser(message);
        let logMessage = ` chatId : ${message.chat.id}\n from : [${userInfo.UserId}] ${userInfo.UserName}\n message : ${message.text}`;
        console.log(logMessage);
    });
}

