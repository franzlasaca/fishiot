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

      realtimeSetofFunctions();
      setInterval(realtimeSetofFunctions, 1000); 

      function realtimeSetofFunctions()
      {
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

//-----------------------------------------CODE BLOCK FOR CHART PRESENTATION----------------------------------------------------
  
      var avg_chart = document.getElementById("thirdChart").getContext("2d");

      var avg_chart_data = {
          labels: [],
          datasets: [{
              label: "Average Temperature Per Date",  
              backgroundColor: "rgba(0, 204, 153, 0.2)",
              borderColor: "rgba(0, 204, 153, 1)",
              data: []
          }]
        };

      var avg_chart_options = {
          responsive: true,
        scales: {
            yAxes: [{
                ticks: {

                    beginAtZero: true,
                    max: 70,

                    callback: function(value, index, values) {
                        return value + " " + String.fromCharCode(176) + "C";    //add degrees sign in the y-axis labels in the chart
                    }
                }
            }]
        }
      };

      var count_normal = 0;
      var count_warning1 = 0;
      var count_warning2 = 0;
      var count_critical = 0;

      $.ajax        //ajax call for calling the average temperature per date
      ({
          url: "php/sql_add.php",
          type: 'post',
          data:{
              function: "get_avg_temp_per_date",
              user_id: user_id,
              pond_id: pond_id
          },
          success: function(res) 
          {
              var parsed = JSON.parse(res);

              for (var x = 0; x < parsed.length; x++)
              {
                  var temp_insert = avg_chart_data.datasets[0].data;
                  var label_insert = avg_chart_data.labels;

                  temp_insert.push(parsed[x][1]);
                  label_insert.push(parsed[x][0]);

                  setOfficialData(parseFloat(parsed[x][1]));
              }

              var wut = new Chart(avg_chart, {   //initiate action logs chart
                  type: "line",
                  data: avg_chart_data, 
                  options: avg_chart_options,
              });
          }
      });
//-------------------------------------------------END OF CODE BLOCK----------------------------------------------------------


      function setOfficialData(temperature)    //function to get the overall average production status of the pond since its creation
      {
          //DATA ANALYSIS AND PRESENTATION

          if (temperature >= 24 && temperature < 36)   //NORMAL LEVEL
          {
              count_normal++;
          }
          else if ((temperature >= 16 && temperature < 24) || (temperature >= 36 && temperature < 44))    //WARNING LEVEL
          {
              if ((temperature >= 20 && temperature < 24) || (temperature >= 36 && temperature < 40))
              {
                  count_warning1++;
              }
              else
              {
                  count_warning2++;
              }
          }
          else    // CRITICAL LEVEL
          {
              count_critical++;
          }

          var list_of_counts = [count_normal, count_warning1, count_warning2, count_critical];
          var get_index = list_of_counts.indexOf(Math.max.apply(Math,list_of_counts));    //get highest count number among the production status

          if (get_index == 0)
          {
              $("#prod_status").text("Normal");
          }
          else if (get_index == 1)
          {
              $("#prod_status").text("Warning 1");
          }
          else if (get_index == 2)
          {
              $("#prod_status").text("Warning 2");
          }
          else
          {
              $("#prod_status").text("Critical");
          }
      }

});