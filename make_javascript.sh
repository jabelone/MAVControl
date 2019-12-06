test -z "$MDEF" && MDEF="../message_definitions"
mkdir generator/javascript/v1
mkdir generator/javascript/v2
echo "---------------------------------------------------------------------------------------------------"
mavgen.py --lang JavaScript ../message_definitions/v1.0/ardupilotmega.xml -o generator/javascript/v1/mav_v1.js --wire-protocol=1.0
echo "---------------------------------------------------------------------------------------------------"
mavgen.py --lang JavaScript ../message_definitions/v1.0/ardupilotmega.xml -o generator/javascript/v2/mav_v2.js --wire-protocol=2.0
echo "---------------------------------------------------------------------------------------------------"
