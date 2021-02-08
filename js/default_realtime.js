$(document).ready(function() {

      var pond_id = localStorage.getItem("pond_id");
      var user_id = localStorage.getItem("user_id");

      $.ajax    //get pond name
            ({
              type:'post',
              url:'php/sql_add.php',
              data:{
                   function: "get_pond_details",
                   pond_id: pond_id,
                   user_id: user_id
              },
              success: function(response) 
              {
                    var res = JSON.parse(response);
                    $("#pondname").text(res[0]);
              }
        });

      var nodataFlag = true;
      var notifFlag = true;
      var dataFlag = true;

      var temperature = 0;
      var do_lvl = 0;
      var prev_temperature = 0;

      var gun = Gun('https://fishiot-server.herokuapp.com/gun');   //online server
      //var gun = Gun('http://192.168.1.2:10000/gun');   //local server
      //var gun = Gun('http://localhost:10000/gun');    //computer-only server

      gun.get('IoT').on(function(datum, id) //retrieve temperature, previous temperature and DO lvl data from gundb
      {
            temperature = datum.temperature;
            do_lvl = datum.DOlvl;
            prev_temperature = datum.previous_temperature;
      });  

      system_notif(temperature, prev_temperature, pond_id, user_id);
      
      setInterval(function() {
          system_notif(temperature, prev_temperature, pond_id, user_id);  //function to show notification for fluctuations
      }, 1000)

      function system_notif(current, past, pond, user)
      {
          if ((current != -69 && current != -127) && (past != -69 && past != -127))
          {
              if (current < 24 || current >= 36)
              {
                    notifFlag = false;
              }
              else if ((current >= 24 && current < 36) && (past < 24 || past >= 36) && (!notifFlag))
              {
                  $.ajax    //get duration of the latest fluctuation occurrence
                  ({
                      type:'post',
                      url:'php/sql_add.php',
                      data:{
                           function: "get_latest_fluctuation_log",
                           pond_id: pond,
                           user_id: user
                      },
                      success: function(response) 
                      {     
                            console.log(response);
                            var sec = parseInt(response);
                            var str = "";

                            if (sec < 60)
                            {
                                if (sec == 1)
                                {
                                    str = sec + " second";
                                }
                                else
                                {
                                    str = sec + " seconds";
                                }
                            }
                            else if (sec >= 60 && sec < 3600)
                            {
                                var min = Math.floor(sec / 60);
                                sec = sec % 60;

                                if (min == 1)
                                {
                                    str += min + " minute";
                                }
                                else
                                {
                                    str += min + " minutes";
                                }

                                if (sec == 1)
                                {
                                    str += " and " + sec + " second";
                                }
                                else if (sec > 1)
                                {
                                    str += " and " + sec + " seconds";
                                }
                            }

                            var the_txt = "Added " + str + " to timeline"

                            iziToast.info({
                                    icon: "far fa-clock",
                                    title: 'Pond Production Timeline',
                                    message: the_txt
                            });     
                      }
                  });

                  notifFlag = true;
              }
              
          }
          else if ((current != -69 && current != -127) && nodataFlag)
          {
                iziToast.success({
                        icon: 'fas fa-check',
                        title: 'System Commences',
                        message: 'Temperature sensor attached and activated'
                });  

                dataFlag = true;
                nodataFlag = false;
          }
          else if ((current == -69 || current == -127) && dataFlag)
          {
                iziToast.error({
                        icon: 'fas fa-times',
                        title: 'No data recorded',
                        message: 'Temperature sensor may not be working or is disconnected'
                }); 

                dataFlag = false;
                nodataFlag = true;
          }
      }

});