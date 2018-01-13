let defaultMapLocation = [-27.506537, 153.023248];

let planeBlue = L.icon({
    iconUrl: '/static/img/plane.png',

    iconSize:     [100, 100], // size of the icon
    shadowSize:   [0, 0], // size of the shadow
    iconAnchor:   [60, 60], // point of the icon which will correspond to marker's location
    shadowAnchor: [60, 60],  // the same for the shadow
    popupAnchor:  [0, -30] // point from which the popup should open relative to the iconAnchor
});

let zoomGranularity = 0.2;
let leafletmap = L.map('map', {closePopupOnClick: false, zoomSnap: zoomGranularity, zoomDelta: zoomGranularity,
    autoClose: false, className: "map_popup"}).setView(defaultMapLocation, 18);

L.tileLayer('https://api.mapbox.com/styles/v1/jabelone/cjcd5slq139jx2sqmzjg2ivmd/tiles/256/{z}/{x}/{y}?access_token=pk.eyJ1IjoiamFiZWxvbmUiLCJhIjoiY2pjZDVyYjBhMDl5ZjJxbXQ2Y21nbW83NyJ9.GmU38VLHRzMb17bZMEarDg', {
    maxZoom: 19,
}).addTo(leafletmap);

let planeMarker = L.marker(defaultMapLocation, {icon: planeBlue, rotationOrigin: "center center",
    title: "Vehicle"}).addTo(leafletmap);