cd ~/GCS/mavlink/pymavlink
test -z "$MDEF" && MDEF="../message_definitions"
mkdir -p generator/javascript/v1
mkdir -p generator/javascript/v2
echo "---------------------------------------------------------------------------------------------------"
./tools/mavgen.py --lang JavaScript $MDEF/v1.0/ardupilotmega.xml -o generator/javascript/v1/mav_v1.js --wire-protocol=1.0
echo "---------------------------------------------------------------------------------------------------"
./tools/mavgen.py --lang JavaScript $MDEF/v1.0/ardupilotmega.xml -o generator/javascript/v2/mav_v2.js --wire-protocol=2.0
echo "---------------------------------------------------------------------------------------------------"
cp generator/javascript/v1/mav_v1.js ~/GCS/MAVControl/mav_v1.js
cp generator/javascript/v2/mav_v2.js ~/GCS/MAVControl/mav_v2.js
