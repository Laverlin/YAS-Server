process.env["NTBA_FIX_319"] = "1";
import TelegramBot = require('node-telegram-bot-api');
import request = require('request-promise-native');
import xml2js = require('xml2js');

import { UserInfo } from "./UserInfo";
import { Route } from "./Route";
import { WayPoint } from "./Route";
import { isNullOrUndefined } from 'util';
import { DbMongo } from './DbMongo';

const https = require('https');

// Error handling
//
function processError(telegramBot: TelegramBot, chatId: number, url: string, error: string) {
    console.log((new Date()).toUTCString() + ' :: request error:', error);
    console.log((new Date()).toUTCString() + ' :: request url:', url);
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

function parseKmlResponse(response, telegramBot, chatId, match, connectionString) {

    if (!response.includes(`<kml xmlns="http://www.opengis.net/kml/2.2">`)) { return; }

    let parser = new xml2js.Parser();
    parser.parseString(response, async function (error, result) {

        if (!isNullOrUndefined(error)) {
            processError(telegramBot, chatId, match, error);
            return;
        }

        try {
            let route = new Route('Route');
            let placemarks = result['kml']['Document'][0]['Placemark'];
            if (placemarks.length > 1) {
                for (let i = 0; i < placemarks.length; i++)
                    if (placemarks[i]['styleUrl'] != '#RouteStyle') {
                        let points = placemarks[i]['Point'][0]['coordinates'][0].split(',');
                        let wayPoint = new WayPoint(placemarks[i]['name'][0], points[1], points[0]);
                        route.WayPoints.push(wayPoint);
                    }
            } else {
                route = new Route(placemarks[0]['ExtendedData'][0]['Data'][0]['value'][0]);
                let coords = placemarks[0]['LineString'][0]['coordinates'][0].split(' ');
                for (let i = 0; i < coords.length; i++) {
                    let points = coords[i].split(',');
                    let wayPoint = new WayPoint('WP-' + i.toString(), points[1], points[0]);
                    route.WayPoints.push(wayPoint);
                }
            }

            let dbMongo = new DbMongo(connectionString);
            let userId = await dbMongo.AddRoute(route, chatId)
            let outMessage = `${route.RouteName} (${route.WayPoints.length} way points) has been uploaded \n userId:${userId}`;
            telegramBot.sendMessage(chatId, outMessage);
            console.log(outMessage);

        }
        catch (error) {
            processError(telegramBot, chatId, match, error);
        }
    });
}

// Run bot and process user requests
//
export async function RunBot(telegramToken: string, connectionString: string) {

    let telegramBot = new TelegramBot(telegramToken, { polling: true });

    let kmlUrlPattern = /(http:\/\/www\.|https:\/\/www\.|http:\/\/|https:\/\/)(tinyurl.com|social-sharing.navionics.io)(:[0-9]{1,5})?(\/.*)?$/igm;

    telegramBot.onText(/Start/i, async (inMessage, match) => {
        let outMessage = "/myid `- return ID-string to identify your routes`\n\n/list `- route list `\n\n /rename <new name> `- rename last uploaded route`\n\n /rename:<id> <new name> `- set <new name> to route with <id>`\n\n /delete:<id> `delete route with <id>`";
        telegramBot.sendMessage(inMessage.chat.id, outMessage, { parse_mode: "Markdown" });
    })

    // Download route from Navionics
    //
    telegramBot.onText(kmlUrlPattern, async (inMessage, match) => {

        let urls = inMessage.text.match(kmlUrlPattern);

        urls.forEach((url) => {
            request(url)
                .then(function (response) {
                    parseKmlResponse(response, telegramBot, inMessage.chat.id, url, connectionString)
                })
                .catch(function (error) {
                    processError(telegramBot, inMessage.chat.id, url, error.name + ", code:" + error.statusCode);
                });
        });
    });

    // Download route from Navionics - new api
    //
    telegramBot.onText(/https:\/\/boating.page.link([^;]+)/i, async (inMessage, match) => {

        https.get(inMessage.text, (resp) => {

            const { statusCode } = resp;
            let url = resp.headers['location'];
            if (statusCode == 302) {
                let addr = url.match(kmlUrlPattern)[0];
                request(addr)
                    .then(function (response) {
                        parseKmlResponse(response, telegramBot, inMessage.chat.id, addr, connectionString)
                    })
                    .catch(function (error) {
                        processError(telegramBot, inMessage.chat.id, addr, error.name + ", code:" + error.statusCode);
                    });
            }
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
                telegramBot.sendMessage(inMessage.chat.id, outMessage, { parse_mode: "Markdown" });
                console.log(`\t => ${outMessage}`);
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
        console.log(`\t => ${outMessage}`);
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
        console.log(`\t => ${outMessage}`);
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
        console.log(`\t => ${outMessage}`);

    });

    telegramBot.onText(/myid/i, async (inMessage, match) => {
        let outMessage = "";

        let dbMongo = new DbMongo(connectionString);
        let result = await dbMongo.GetUserId(inMessage.from.id);
        outMessage = result;
        telegramBot.sendMessage(inMessage.chat.id, outMessage);
        console.log(`\t => ${outMessage}`);

    })

    // Log incoming requests
    //
    telegramBot.on("text", (message) => {



        let userInfo = ExtractUser(message);
        let logMessage = `${(new Date()).toUTCString()} :: from : [${userInfo.UserId}] ${userInfo.UserName}\n\t message : ${message.text}`;
        console.log(logMessage);

    });
}