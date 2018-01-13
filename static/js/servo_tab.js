// ====== Servo Tab Stuff ======

$(document).ready(function () {
    let servo_toggle = document.getElementsByClassName("servo_toggle");
    for (let i = 0; i < servo_toggle.length; i++) {
        servo_toggle[i].addEventListener('click', function () {
            let servo_toggled = $(this).data("servo_number");
            // TODO implement sending mavlink packet for servo control
            Materialize.toast('Sent servo ' + servo_toggled + " toggled", 2000);
        }, false);
    }

    for (let i = 5; i < 15; i++) {
        let number = i;
        let servo_row = `<div data-servo_number="${number}" class="servo_row row">
                            <div class="valign-wrapper col s12 m4 l2">
                                <h6>Servo ${number}</h6>
                            </div>
                            <div class="col s12 m4 l2">
                                <a data-servo_number="${number}" class="low_servo waves-effect blue waves-light btn">
                                    Low
                                </a>
                            </div>
                            <div class="col s12 m4 l2">
                                <a data-servo_number="${number}" class="high_servo waves-effect blue waves-light btn">
                                    High
                                </a>
                            </div>
                            <div class="col s12 m4 l3">
                                <div class="input-field">
                                    <input id="low_servo_value" placeholder="1000 μs" data-servo_number="${number}"
                                           type="number" min="800" max="2200" step="10" class="validate">
                                </div>
                            </div>
                            <div class="col s12 m4 l3">
                                <div class="input-field">
                                    <input id="high_servo_value" placeholder="2000 μs" data-servo_number="${number}"
                                           type="number" min="800" max="2200" step="10" class="validate">
                                </div>
                            </div>
                        </div>`;
        document.getElementById("servo_tab").insertAdjacentHTML('beforeend', servo_row);
    }

    // ====== Servo High Buttons ======
    let servo_high = document.getElementsByClassName("high_servo");
    for (let i = 0; i < servo_high.length; i++) {
        servo_high[i].addEventListener('click', function () {
            let servo_toggled = $(this).data("servo_number");
            // TODO implement sending mavlink packet for servo high
            Materialize.toast('Servo ' + servo_toggled + " high", 2000);
        }, false);
    }

    // ====== Servo Low Buttons ======
    let servo_low = document.getElementsByClassName("low_servo");
    for (let i = 0; i < servo_low.length; i++) {
        servo_low[i].addEventListener('click', function () {
            let servo_toggled = $(this).data("servo_number");
            // TODO implement sending mavlink packet for servo low
            Materialize.toast('Servo ' + servo_toggled + " low", 2000);
        }, false);
    }

});