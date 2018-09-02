import ShortId = require('shortid');
import { MongoClient, Collection } from "mongodb";
import { Route } from "./Route";
import { RouteUser } from "./Route";
import { isNullOrUndefined } from "util";

/// class for mongo operations
///
export class DbMongo {

    private url: string;
    private connection: MongoClient;

    constructor(url: string) {
        this.url = url;
    }

    private async getRoutes(): Promise<Collection<any>> {
        this.connection = await MongoClient.connect(this.url, { useNewUrlParser: true });
        let routeDb = this.connection.db("RouteDB");
        let routes = routeDb.collection("Routes");
        return routes;
    }

    private closeDb() {
        this.connection.close();
    }

    // Add route to db
    //
    async AddRoute(route: Route, telegramId : number):Promise<string> {

        let routes = await this.getRoutes();
        let routeUser: RouteUser = await routes.findOne({ TelegramUserId: telegramId });
        if (isNullOrUndefined(routeUser)) {
            routeUser = new RouteUser();
            routeUser.TelegramUserId = telegramId;
            routeUser.UserId = ShortId.generate();
            routeUser.PublicUserId = ShortId.generate();
            routeUser.Routes = new Array<Route>();
        }
        route.RouteId = ShortId.generate();
        routeUser.Routes.push(route);
        routeUser.TotalRoutes += 1;
        route.RouteName = route.RouteName + " [" + routeUser.TotalRoutes.toString() + "]";

        await routes.update({ UserId: routeUser.UserId }, routeUser, { upsert: true });

        this.closeDb();

        return routeUser.UserId;
    }

    // Get list of routes for specific user
    //
    async GetRouteList(userId: string): Promise<Array<Route>> {
        let routes = await this.getRoutes();

        let routeList = new Array<Route>();
        let routeUser: RouteUser = await routes.findOne({ UserId: userId });
        if (!isNullOrUndefined(routeUser))
            routeList = routeUser.Routes.sort(function (a, b) { return b.RouteDate.valueOf() - a.RouteDate.valueOf() });

        this.closeDb();
        return routeList;
    }
}