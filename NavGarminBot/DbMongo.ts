var ShortId = require('shortid');
import { MongoClient } from "mongodb";
import { Route } from "./Route";
import { RouteUser } from "./Route";
import { isNullOrUndefined } from "util";

/// class for mongo operations
///
export class DbMongo {

    private url: string;

    constructor(url: string) {
        this.url = url;
    }

    // Add route to db
    //
    async AddRoute(route: Route, telegramId : number) {

        let connection = await MongoClient.connect(this.url);
        let routeDb = connection.db("RouteDB");
        let routes = routeDb.collection("Routes");
        let routeUser: RouteUser = await routes.findOne({ TelegramUserId: telegramId });
        if (isNullOrUndefined(routeUser)) {
            routeUser = new RouteUser();
            routeUser.TelegramUserId = telegramId;
            routeUser.UserId = ShortId.generate();
            routeUser.PublicUserId = ShortId.generate();
            routeUser.Routes = new Array<Route>();
        }

        routeUser.Routes.push(route);
        routeUser.TotalRoutes += 1;
        route.RouteName = route.RouteName + " [" + routeUser.TotalRoutes.toString() + "]";

        await routes.update({ UserId: routeUser.UserId }, routeUser, { upsert: true });

        connection.close();
        console.log("Route " + route.RouteName + " for user " + routeUser.UserId + " has been added");
    }
}