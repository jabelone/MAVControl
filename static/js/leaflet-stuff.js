let defaultMapLocation = [-27.506537, 153.023248];

/* 
let planeBlue = L.icon({
    iconUrl: '/static/img/plane.png',
    iconSize: [100, 100], // size of the icon
    shadowSize: [0, 0], // size of the shadow
    iconAnchor: [50, 50], // point of the icon which will correspond to marker's location
    shadowAnchor: [60, 60],  // the same for the shadow
    popupAnchor: [0, -30] // point from which the popup should open relative to the iconAnchor
});
*/

// things the same amoungst all icons:
var myIcons = L.Icon.extend({
    options: {
    //iconUrl: '/static/img/plane.png',
    iconSize: [100, 100], // size of the icon
    shadowSize: [0, 0], // size of the shadow
    iconAnchor: [50, 50], // point of the icon which will correspond to marker's location
    shadowAnchor: [60, 60],  // the same for the shadow
    popupAnchor: [0, -30] // point from which the popup should open relative to the iconAnchor
    }
});

// build icon list
blackIcon = new myIcons({iconUrl: '/static/img/plane_black.png'}),
greenIcon = new myIcons({iconUrl: '/static/img/plane_green.png'}),
indigoIcon = new myIcons({iconUrl: '/static/img/plane_indigo.png'}),
orangeIcon = new myIcons({iconUrl: '/static/img/plane_orange.png'}),
blueIcon = new myIcons({iconUrl: '/static/img/plane.png'}),
purpleIcon = new myIcons({iconUrl: '/static/img/plane_purple.png'}),
redIcon = new myIcons({iconUrl: '/static/img/plane_red.png'});
iconlist = [];
iconlist.push(redIcon,blackIcon,blueIcon,greenIcon,indigoIcon,orangeIcon,purpleIcon); // so sysid0 is red, sysid1 is black, sysid2 is blue etc

// redefine standard L.i to point to my L.I ( case important ) 
L.icon = function (options) {
    return new L.Icon(options);
};

let zoomGranularity = 0.2;
let leafletmap = L.map('map', {
    closePopupOnClick: false, zoomSnap: zoomGranularity, zoomDelta: zoomGranularity,
    autoClose: false, className: "map_popup"
});
leafletmap.setView(defaultMapLocation, 18);

// this is how we'd make one, if it was just one, but we make one-per-plane now.
//let planeMarker = L.marker(defaultMapLocation, {
//    icon: planeBlue, rotationOrigin: "center center",
//    title: "Vehicle"
//}).addTo(leafletmap);

// create a red polyline from an array of LatLng points
flightPath = L.polyline([], {color: 'red'}).addTo(leafletmap);


let layer = L.tileLayer('https://api.mapbox.com/styles/v1/jabelone/cjcd5slq139jx2sqmzjg2ivmd/tiles/256/{z}/{x}/{y}?access_token=pk.eyJ1IjoiamFiZWxvbmUiLCJhIjoiY2pjZDVyYjBhMDl5ZjJxbXQ2Y21nbW83NyJ9.GmU38VLHRzMb17bZMEarDg',  {
    minZoom: 5,
    maxZoom: 19,
    crossOrigin: true
});

layer.addTo(leafletmap);


