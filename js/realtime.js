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
                    $("#display_density").text(res[2]);
                    $("#display_area").text(res[3]);
                    $("#display_deadline").text(res[4]);
              }
      });

      var gun = Gun('https://fishiot-server.herokuapp.com/gun');   //online server
      //var gun = Gun('http://192.168.1.2:10000/gun');   //local server
      //var gun = Gun('http://localhost:10000/gun');    //computer-only server
      var temperature = 0;
      var do_lvl = 0;
      var prev_temperature = 0;

      gun.get('IoT').on(function(datum, id) //retrieve temperature, previous temperature and DO lvl data from gundb
      {
            temperature = datum.temperature;
            do_lvl = datum.DOlvl;
            prev_temperature = datum.previous_temperature;
      });  

      //-----------------------------code block for realtime temperature chart----------------------------------

      var ctx = document.getElementById("myChart").getContext("2d");    //the chart instance in Dashboard section

      var temperature_data = {    //holds the dataset and labels of the chart
        labels: [],
        datasets: [{
          label: "Temperature (from Local Server)",   
          backgroundColor: "rgba(255, 99, 132, 0.2)",
          borderColor: "rgba(255,99,132,1)",
          data: []
        }]
      };

      var temp_options = {    //stores the settings of the chart
        responsive: true,
        animation: false,
        //Boolean - If we want to override with a hard coded scale
        scaleOverride: true,
        //** Required if scaleOverride is true **
        //Number - The number of steps in a hard coded scale
        scaleSteps: 10,
        //Number - The value jump in the hard coded scale
        scaleStepWidth: 10,
        //Number - The scale starting value
        scaleStartValue: 0,

        scales: {
            yAxes: [{
                ticks: {

                    beginAtZero: true,
                    steps: 10,
                    stepValue: 5,
                    max: 50,

                    callback: function(value, index, values) {
                        return value + " " + String.fromCharCode(176) + "C";    //insert degrees sign in the y-axis labels of the chart
                    }
                }
            }]
        },
        legend: {
            display: false,
            labels: {
                fontSize: 8
            }
        }
      };

      //-----------------------------------------------end of code block---------------------------------------------------------

      var nodataFlag = true;
      var notifFlag = true;
      var dataFlag = true;

      realtimeSetofFunctions();
      setInterval(realtimeSetofFunctions, 1000);   //this function will continue to execute every second (for real-time execution)

      function realtimeSetofFunctions() //function to simulate the realtime data presentation
      {
          setOfficialData(temperature_data.datasets[0].data);    //function responsible for adding chart data (as seen above)
          setLabels(temperature_data.labels);   //set labels for the chart

          var myLineChart = new Chart(ctx , {   //initiate temperature chart
                  type: "line",
                  data: temperature_data, 
                  options: temp_options,
              });

          $.ajax    //get pond name and display production timeline
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
                    var formatted_txt = "";

                    var leftover = parseInt(res[1]);

                    if (leftover <= 0)
                    {
                        formatted_txt = "Due time for harvest";
                    }
                    else
                    {
                        var mos = Math.floor(leftover / 2629746);
                        leftover -= (mos * 2629746);
                        var days = Math.floor(leftover / 86400);
                        leftover -= (days * 86400);
                        var hours = Math.floor(leftover / 3600);
                        leftover -= (hours * 3600);
                        var minutes = Math.floor(leftover / 60);
                        leftover -= (minutes * 60);

                        if (mos > 0)
                        {
                            if (mos == 1)
                            {
                                formatted_txt += mos + " mo";
                            }
                            else if (mos > 1)
                            {
                                formatted_txt += mos + " mos";
                            }

                            if (days == 1)
                            {
                                formatted_txt += ", " + days + " day";
                            }
                            else if (days > 1)
                            {
                                formatted_txt += ", " + days + " days";
                            }

                            if (hours == 1)
                            {
                                formatted_txt += ", " + hours + " hr";
                            }
                            else if (hours > 1)
                            {
                                formatted_txt += ", " + hours + " hrs";
                            }

                            if (minutes == 1)
                            {
                                formatted_txt += ", " + minutes + " min";
                            }
                            else if (minutes > 1)
                            {
                                formatted_txt += ", " + minutes + " mins";
                            }

                            if (leftover == 1)
                            {
                                formatted_txt += " and " + leftover + " sec";
                            }
                            else if (leftover > 1)
                            {
                                formatted_txt += " and " + leftover + " secs";
                            }
                        }

                        if (days > 0 && mos == 0)
                        {

                            if (days == 1)
                            {
                                formatted_txt += days + " day";
                            }
                            else if (days > 1)
                            {
                                formatted_txt += days + " days";
                            }

                            if (hours == 1)
                            {
                                formatted_txt += ", " + hours + " hr";
                            }
                            else if (hours > 1)
                            {
                                formatted_txt += ", " + hours + " hrs";
                            }

                            if (minutes == 1)
                            {
                                formatted_txt += ", " + minutes + " min";
                            }
                            else if (minutes > 1)
                            {
                                formatted_txt += ", " + minutes + " mins";
                            }

                            if (leftover == 1)
                            {
                                formatted_txt += " and " + leftover + " sec";
                            }
                            else if (leftover > 1)
                            {
                                formatted_txt += " and " + leftover + " secs";
                            }
                        }

                        if (hours > 0 && days == 0 && mos == 0)
                        {

                            if (hours == 1)
                            {
                                formatted_txt += hours + " hr";
                            }
                            else if (hours > 1)
                            {
                                formatted_txt += days + " hrs";
                            }

                            if (minutes == 1)
                            {
                                formatted_txt += ", " + minutes + " min";
                            }
                            else if (minutes > 1)
                            {
                                formatted_txt += ", " + minutes + " mins";
                            }

                            if (leftover == 1)
                            {
                                formatted_txt += " and " + leftover + " sec";
                            }
                            else if (leftover > 1)
                            {
                                formatted_txt += " and " + leftover + " secs";
                            }
                        }

                        if (minutes > 0 && mos == 0 && days == 0 && hours)
                        {
                            if (minutes == 1)
                            {
                                formatted_txt += minutes + " min";
                            }
                            else if (minutes > 1)
                            {
                                formatted_txt += minutes + " mins";
                            }

                            if (leftover == 1)
                            {
                                formatted_txt += " and " + leftover + " sec";
                            }
                            else if (leftover > 1)
                            {
                                formatted_txt += " and " + leftover + " secs";
                            }
                        }

                        if (leftover > 0 && mos == 0 && days == 0 && minutes == 0 && hours == 0)
                        {
                            if (leftover == 1)
                            {
                                formatted_txt += leftover + " sec";
                            }
                            else if (leftover > 1)
                            {
                                formatted_txt += leftover + " secs";
                            }
                        }
                    }

                    $("#display_timeline").text(formatted_txt);
              }
          });

          system_notif(temperature, prev_temperature, pond_id, user_id);  //function to show notification for fluctuations
      }

      function setLabels(labels)    //functions to generate the x-axis labels in the real-time temperature chart (current time)
      {    
            date = new Date();
            var hours = date.getHours();
            var minutes = date.getMinutes();
            var seconds = date.getSeconds();
            var ampm = hours >= 12 ? 'PM' : 'AM';
            hours = hours % 12;
            if (hours == 0)
            {
                hours = 12;
            }
            if (minutes < 10)
            {
                minutes = "0" + minutes;
            }
            if (seconds < 10)
            {
                seconds = "0" + seconds;
            }
            var strTime = hours + ':' + minutes + ':' + seconds + ' ' + ampm;

            labels.push(strTime);

            if (labels.length > 7)
            {
                labels.shift();
            }
      }

      function setOfficialData(data1)    //function for data presentation in the Dashboard section
      {
            var tempstat = "";
            var pondstat = "";
            
            //DATA ANALYSIS AND PRESENTATION
            if (temperature >= 24 && temperature < 36) //NORMAL LEVEL
            {
                if (temperature >= 26 && temperature < 34)
                {
                    tempstat = "BETTER - BEST";
                }
                else
                {
                    tempstat = "GOOD";
                }

                pondstat = "Normal";

                $("#temp_div").addClass("bg-gradient-success");
                $("#temp_div").removeClass("bg-gradient-info");
                $("#temp_div").removeClass("bg-gradient-warning");
                $("#temp_div").removeClass("bg-gradient-danger");
                $("#temp_div").removeClass("bg-gradient-primary");
            }
            else if ((temperature >= 16 && temperature < 24) || (temperature >= 36 && temperature < 44))    //WARNING LEVEL
            {
                if (temperature >= 16 && temperature < 24)
                {
                    $("#temp_div").removeClass("bg-gradient-success");
                    $("#temp_div").addClass("bg-gradient-info");
                    $("#temp_div").removeClass("bg-gradient-warning");
                    $("#temp_div").removeClass("bg-gradient-danger");
                    $("#temp_div").removeClass("bg-gradient-primary");
                }
                else if (temperature >= 36 && temperature < 44)
                {
                    $("#temp_div").removeClass("bg-gradient-success");
                    $("#temp_div").removeClass("bg-gradient-info");
                    $("#temp_div").addClass("bg-gradient-warning");
                    $("#temp_div").removeClass("bg-gradient-danger");
                    $("#temp_div").removeClass("bg-gradient-primary");
                }

                if ((temperature >= 20 && temperature < 24) || (temperature >= 36 && temperature < 40))
                {
                    pondstat = "Warning 1";
                    tempstat = "BAD";
                }
                else if ((temperature >= 16 && temperature < 20) || (temperature >= 40 && temperature < 44))
                {
                    pondstat = "Warning 2";
                    tempstat = "WORSE";
                }
            }
            else    // CRITICAL LEVEL
            {
                pondstat = "Critical";
                tempstat = "WORST";

                if (temperature < 16)
                {
                    $("#temp_div").removeClass("bg-gradient-success");
                    $("#temp_div").removeClass("bg-gradient-info");
                    $("#temp_div").removeClass("bg-gradient-warning");
                    $("#temp_div").removeClass("bg-gradient-danger");
                    $("#temp_div").addClass("bg-gradient-primary");
                }
                else if (temperature >= 44)
                {
                    $("#temp_div").removeClass("bg-gradient-success");
                    $("#temp_div").removeClass("bg-gradient-info");
                    $("#temp_div").removeClass("bg-gradient-warning");
                    $("#temp_div").addClass("bg-gradient-danger");
                    $("#temp_div").removeClass("bg-gradient-primary");
                }
            }

            //code block to identify dissolved oxygen level status
            var do_status = "";

            if (do_lvl >= 3 && do_lvl < 4)
            {
                do_status = "WORSE";
            }
            else if (do_lvl >= 4 && do_lvl < 6)
            {
                do_status = "BAD";
            }
            else if (do_lvl >= 6 && do_lvl <= 7)
            {
                do_status = "GOOD";
            }
            else if (do_lvl > 7 && do_lvl <= 9)
            {
                do_status = "BETTER";
            }
            else if (do_lvl > 9)
            {
                do_status = "BEST";
            }
            else
            {
                do_status = "WORST";
            }

            display_logs();

            if (temperature != -127 && temperature != -69)  //if current temperature is not user-default or not coming from a disconnected/malfunctioned temperature sensor
            {
                data1.push(temperature);                    //add current temperature as part of chart's dataset
                $("#tempstat").text(tempstat);              //display temperature status
                $("#pond_status").text(pondstat);           //display production status
                $("#temperature_lvl").text(temperature);    //display current temperature
                $("#DO_lvl").text(do_lvl);                  //display current dissolved oxygen level
                $("#display_do_stat").text(do_status);      //display DO lvl status
            }
            else
            {
                notRealTemperature = "N/A";

                data1.push(0);                    //add 0 (default) as part of chart's dataset
                $("#tempstat").text(notRealTemperature);
                $("#pond_status").text(notRealTemperature);
                $("#temperature_lvl").text(notRealTemperature); 
                $("#DO_lvl").text(notRealTemperature);
                $("#display_do_stat").text(notRealTemperature);
            }

            if (data1.length > 7)   //creates seven data in the chart's dataset
            {
                data1.shift();     //remove first instance in the dataset to be replaced by the latest data (current temperature)
            }
      }

      function display_logs()   //function for data presentation of the system's actions and well-being status of the fish over time
      {

            $.ajax
            ({
              type:'post',
              url:'php/sql_add.php',
              data:{
                   function: "actionlog",
                   pond_id: pond_id,
                   user_id: user_id
              },
              success: function(response) 
              {
                    $('#actionlog').html(response);
              }

            });

            $.ajax
            ({
              type:'post',
              url:'php/sql_add.php',
              data:{
                   function: "croplog",
                   pond_id: pond_id,
                   user_id: user_id
              },
              success: function(response) 
              {
                    $('#croplog').html(response);
              }

            });

      }

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