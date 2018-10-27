import ShortId = require('shortid');
import { MongoClient, Collection } from "mongodb";
import { Route } from "./Route";
import { RouteUser } from "./Route";
import { isNullOrUndefined } from "util";
import { AssertionError } from 'assert';

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
        routeUser.TotalRoutes += 1;
        route.RouteId = routeUser.TotalRoutes.toString();
        routeUser.Routes.push(route);
        route.RouteName = route.RouteName + "-" + routeUser.TotalRoutes.toString();

        await routes.update({ UserId: routeUser.UserId }, routeUser, { upsert: true });

        this.closeDb();

        return routeUser.UserId;
    }

    // Get list of routes for specific user
    //
    async GetRouteListByUserId(userId: string): Promise<Array<Route>> {
        return this.getRouteList(userId, null);
    }

    // return route list by telegram user id
    //
    async GetRouteListByTeleId(teleId: number): Promise<Array<Route>> {
        return this.getRouteList(null, teleId);
    }

    // Rename route, if route id is omitted, use the last one
    //
    async RenameRoute(teleId: number, newName: string, routeId?: string) : Promise<boolean> {
        let routes = await this.getRoutes();

        let routeUser: RouteUser = await routes.findOne({ TelegramUserId: teleId });
        if (isNullOrUndefined(routeUser.Routes) || routeUser.Routes.length < 1) {
            this.closeDb();
            return false;
        }

        let route = null;
        if (!isNullOrUndefined(routeId)) {
            route = routeUser.Routes.find(r => r.RouteId == routeId);
        }
        else {
            routeUser.Routes = routeUser.Routes.sort(function (a, b) { return b.RouteDate.valueOf() - a.RouteDate.valueOf() });
            route = routeUser.Routes[0];
        }

        if (isNullOrUndefined(route)) {
            this.closeDb();
            return false;
        }
        route.RouteName = newName;

        await routes.save(routeUser);
        this.closeDb();

        return true;
    }

    // delete appointed route
    //
    async DeleteRoute(teleId: number, routeId: string): Promise<boolean> {
        let routes = await this.getRoutes();

        let routeUser: RouteUser = await routes.findOne({ TelegramUserId: teleId });
        if (isNullOrUndefined(routeUser.Routes) || routeUser.Routes.length < 1) {
            this.closeDb();
            return false;
        }
        let routeIndex = routeUser.Routes.findIndex(r => r.RouteId == routeId);
        if (routeIndex == -1) {
            this.closeDb();
            return false;
        }
        routeUser.Routes.splice(routeIndex, 1);

        await routes.save(routeUser);
        this.closeDb();

        return true;
    }

    // Get list of routes for specific user
    //
    private async getRouteList(userId: string, teleId: number): Promise<Array<Route>> {
        if (isNullOrUndefined(userId) && isNullOrUndefined(teleId))
            throw ("userId or teleId must be not null");

        let routes = await this.getRoutes();

        let routeList = new Array<Route>();
        let routeUser: RouteUser = (!isNullOrUndefined(userId))
            ? await routes.findOne({ UserId: userId })
            : await routes.findOne({ TelegramUserId: teleId });
        if (!isNullOrUndefined(routeUser))
            routeList = routeUser.Routes.sort(function (a, b) { return b.RouteDate.valueOf() - a.RouteDate.valueOf() });

        this.closeDb();
        return routeList;
    }

    public async GetUserId(telegramId): Promise<string> {

        let userId = "";

        let routes = await this.getRoutes();
        let routeUser: RouteUser = await routes.findOne({ TelegramUserId: telegramId });
        if (isNullOrUndefined(routeUser)) {
            routeUser = new RouteUser();
            routeUser.TelegramUserId = telegramId;
            routeUser.UserId = ShortId.generate();
            routeUser.PublicUserId = ShortId.generate();
            routeUser.Routes = new Array<Route>();
            await routes.insert(routeUser);
        }

        this.closeDb();
        return routeUser.UserId;
    }
}