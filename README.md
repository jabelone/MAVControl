# MAVControl
My very much WIP (work in progress) in browser ground control station for ardu things. It's still missing major functionality like a fully detailed HUD etc but I'm actively working on it. Front end is completely in the browser and uses sockets to connect to a python backend. Not mobile/small screen friendly yet but frontend should theoretically run on any device with an up to date web browser.

note: most of the buttons are attached to callbacks and will give you notifications etc but sending the actual mavlink packets have not been implemented on some of them at the moment.

# Installation
It's super easy to install and get running. Just clone the git repo:

https: ```git clone https://github.com/jabelone/MAVControl.git```

ssh: ```git clone git@github.com:jabelone/MAVControl.git```

Then install all of the requirements with pip.
```
cd MAVControl
pip3 install -r requirements.txt
```
To run on linux just use:
```
./app.py
```

Note: We only "officially" support python3 and Ubuntu linux at the moment. It should **theoretically** run on Windows/Mac OS but **it is not tested**. MAVControl currently prefers a screen resolution of around 1920x1080 or higher but will be made mobile/tablet friendly in the future.

# Current State
![screenshot](https://github.com/jabelone/MAVControl/raw/master/screenshot.png)
