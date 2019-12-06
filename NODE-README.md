# note, the node.js backend for MAVControl is written by Buzz, and is even more experimental than the 
# rest of MAVControl, but here's some random notes about it... 

# how I utilise the 'pymavlink' generator to auto-generate a mavlink1 parser:
cp ./make_javascript.sh ~/GCS/mavlink/pymavlink/
cd ~/GCS/mavlink/pymavlink/
./make_javascript.sh
cp ~/GCS/mavlink/pymavlink/generator/javascript/v1/mav_v1.js ~/GCS/MAVControl/
cp ~/GCS/mavlink/pymavlink/generator/javascript/v2/mav_v2.js ~/GCS/MAVControl/

#how to install node dependanceies for this and browserfy etc ( this list comes from package.json , so review it there):
cd MAVControl/
cat package.json
npm install

# sinple test of parser syntax is it at least valid .js?:
node mav_v1.js
node mav_v2.js

# load the generated code in a server-side codebase with 'node':
node mavudp_to_ws_server.js
---------
this is the all-in example with a webserver with websockets AND a UDP mavlink listener/parser, AND supports parsing mavlink params, mission, flightmodes ( alpha),  AND it collects up all the state information that we get from the MAV into a Backbone.js based model ( server-side state-holding element for convenience ), AND it periodically pushes the entire state through the websocket to any web-browser/s that might be present.     TODO , implement the client-side browser support for this in something like MAVControl.

