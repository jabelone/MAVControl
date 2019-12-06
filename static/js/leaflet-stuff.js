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
//let leafletmap = L.map('map', {
//    closePopupOnClick: false, zoomSnap: zoomGranularity, zoomDelta: zoomGranularity,
//    autoClose: false, className: "map_popup"
//});
//leafletmap.setView(defaultMapLocation, 18);

// this is how we'd make one, if it was just one, but we make one-per-plane now.
//let planeMarker = L.marker(defaultMapLocation, {
//    icon: planeBlue, rotationOrigin: "center center",
//    title: "Vehicle"
//}).addTo(leafletmap);


// copied from actions_tab.js
    function set_and_display_mode(mode) { 
        let current_sysid = document.getElementById("update_connection_settings_sysid").value; 
        socket.emit('do_change_mode', current_sysid, mode);
        Materialize.toast('Set MODE to ' + mode, 2000);
    } 


      var leafletmap;
      var    cm,
          ll = new L.LatLng(-36.852668, 174.762675),
          ll2 = new L.LatLng(-36.86, 174.77);
      function showCoordinates (e) {
	     // alert(e.latlng);
          Materialize.toast(e.latlng, 3000);
      }
      function flyhereguided(e) {
           // alert(e.latlng);
            lat = e.latlng.lat;
            lng = e.latlng.lng;
            Materialize.toast('requesting guided, but couldnt do to lat/long yet.. '+e.latlng, 3000);

        mode = "Guided";
        document.getElementById("mode_select").value = mode; // updates other drop-down to also say the mode.
        set_and_display_mode(mode);

      }
      function centerMap (e) {
	      leafletmap.panTo(e.latlng);
      }
      function zoomIn (e) {
	      leafletmap.zoomIn();
      }
      function zoomOut (e) {
	      leafletmap.zoomOut();
      }
      leafletmap = L.map('map', {
            closePopupOnClick: false, zoomSnap: zoomGranularity, zoomDelta: zoomGranularity,
            autoClose: false, className: "map_popup",
	   //   center: ll,
	      zoom: 15,
	      contextmenu: true,
          contextmenuWidth: 140,
	      contextmenuItems: [
          {
		      text: 'Fly Here - GUIDED',
		      callback: flyhereguided
	      },
          {
		      text: 'Show coordinates',
		      callback: showCoordinates
	      }, {
		      text: 'Center map here',
		      callback: centerMap
	      }, '-', {
		      text: 'Zoom in',
		      icon: 'images/zoom-in.png',
		      callback: zoomIn
	      }, {
		      text: 'Zoom out',
		      icon: 'images/zoom-out.png',
		      callback: zoomOut
	  }]
      });
      leafletmap.setView(defaultMapLocation, 18);


// todo, can we change between these map providers on-the-fly?
if (0){
    // open street map can be used, if u prefer. 
    let layer1 = L.tileLayer('http://{s}.tile.osm.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="http://osm.org/copyright">OpenStreetMap</a>',
    minZoom: 5,
    maxZoom: 19,
    crossOrigin: true
	  }).addTo(leafletmap);
}
if (1) {
    // mapbox gps imagery
    let layer2 = L.tileLayer('https://api.mapbox.com/styles/v1/jabelone/cjcd5slq139jx2sqmzjg2ivmd/tiles/256/{z}/{x}/{y}?access_token=pk.eyJ1IjoiamFiZWxvbmUiLCJhIjoiY2pjZDVyYjBhMDl5ZjJxbXQ2Y21nbW83NyJ9.GmU38VLHRzMb17bZMEarDg',  {
        attribution: '&copy; <a href="http://mapbox.com">MapBox</a>',
        minZoom: 5,
        maxZoom: 19,
        crossOrigin: true
    }).addTo(leafletmap);
}

L.marker(ll, {
  contextmenu: true,
  contextmenuItems: [{
      text: 'Marker item',
      index: 0
  }, {
      separator: true,
      index: 1
  }]
}).addTo(leafletmap);

L.marker(ll2, {
  contextmenu: true,
  contextmenuInheritItems: false,
  contextmenuItems: [{
      text: 'Marker item'
  }]
}).addTo(leafletmap);

// create a red polyline from an array of LatLng points
flightPath = L.polyline([], {color: 'red'}).addTo(leafletmap);





