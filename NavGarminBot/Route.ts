export class Route {

    public RouteId: number;
    public RouteDate: Date;
    public RouteName: string;
    public WayPoints: WayPoint[];

    constructor(routeName: string) {
        this.WayPoints = new Array() as WayPoint[];
        this.RouteName = routeName;
        this.RouteDate = new Date();
    }
}

export class WayPoint {
    public PointName: string;
    public Lat: number;
    public Lon: number;

    constructor(pointName: string, lat: number, lon: number) {
        this.PointName = pointName;
        this.Lat = lat;
        this.Lon = lon;
    }
}

export class RouteUser {
    public UserId: string;
    public TelegramUserId: number;
    public PublicUserId: string;
    public Routes: Route[];
    public TotalRoutes: number = 0;
}
