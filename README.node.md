# buzz's notes: 

# how I utilise the 'pymavlink' generator to auto-generate a mavlink1 parser:
#  - assumes u already have a git checkout of the 'mavlink' repo at ~/mavlink/ 
# and that this repo is checked out at ~/MAVControl/
cp ./make_javascript.sh ~/mavlink/pymavlink/
cd ~/mavlink/pymavlink/
./make_javascript.sh
cp ~/mavlink/pymavlink/generator/javascript/v1/mav_v1.js ~/MAVControl/

#how to install node dependanceies for this etc ( this list comes from package.json , so review it there):
cd ~/MAVControl/
cat package.json
npm install

# sinple test of parser syntax is it at least valid .js?:
node mav_v1.js

# actual server code that uses this: 
mavudp_to_ws_server.js
---------
this is the script based on the above and other node stuff. it's a webserver with websockets AND a UDP mavlink listener/parser, AND supports parsing mavlink params, mission, flightmodes ( alpha),  AND it collects up all the state information that we get from the MAV into a Backbone.js based model ( server-side state-holding element for convenience ), AND it periodically pushes the entire state through the websocket to any web-browser/s that might be present.   

