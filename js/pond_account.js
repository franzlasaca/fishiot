
          var gun = Gun('https://fishiot-server.herokuapp.com/gun');   //online server
          //var gun = Gun('http://192.168.1.2:10000/gun');   //local server
          //var gun = Gun('http://localhost:10000/gun');    //computer-only server
          var email = localStorage.getItem("email");
          var password = localStorage.getItem("password");

          displayPond();  //initial display upon page visit

          if(!("email" in localStorage && "password" in localStorage) )
          {
                window.location.href = "login.html";
          }

          window.setInterval(displayPond, 1000);  //update ponds every second

          $.ajax      //retrieve and display user credentials on the website
          ({
            type:'post',
            url:'php/sql_retrieve.php',
            dataType: 'json', 
            data:{
                 email: email,
                 password: password
            },
            success: function(response) 
            {
                $("#desc").text(response[3] + " " + response[4]);
                $("#email_desc").text(response[1]);
                localStorage.user_id = response[0];
                localStorage.phonenum = response[5];
            }

          });

          $("#logout").on('click', function()   //logout function
          {
                  window.localStorage.clear();
                  window.location.href = "login.html";
          });

          function displayPond()
          {
              $.ajax      //display ponds per user
              ({
                type:'post',
                url:'php/sql_add.php',
                data:{
                     function: "pond_display",
                     email: email,
                     password: password
                },
                success: function(response) 
                {
                      $('#sus').html(response);
                }

              });
          }

          function pondId(datum)    //function to store pond credentials in localstorage to be used on Dashboard and local server
          {
                  var phone_num = localStorage.getItem("phonenum");
                  var user_id = localStorage.getItem("user_id");
                  localStorage.pond_id = datum;

                  gun.get("user_credentials").put({ number: phone_num, user_id: user_id, pond_id: datum });
          }

          //-----------------------------------------------------------------------------------------------------------------------------
          //----------------------------- code block for modal function (creating the pond account) -------------------------------------
          //-----------------------------------------------------------------------------------------------------------------------------

          var stocking_density = 0;       //basis for getting the ideal number of fishes that a pond can contain
          var avg_weight = 0;             //average weight of milkfish in different stages (in kilograms)
          var expected_timeline = 0;      //timeline for harvest (in days)

          $('#apcompt').on('change', function() {

              var desc = $("#description").val();     //name of the created pond account/instance
              var length = $("#length").val();        //length of the pond (in meters)
              var width = $("#width").val();          //width of the pond (in meters)

              console.log("Length: " + length);
              console.log("Width: " + width);

              $("#display_density").val("");
              $("#display_result").val("");

              var compt = this.value; 
              if (compt == 1)   //if Nursery Pond is selected
              {   
                  expected_timeline = 60;       //60 days until harvest
                  stocking_density = 40;        //a nursery pond can contain 40 fry per squere meter
                  avg_weight = 0.005;          //a milkfish fry weighs an average of 5 grams

                  var fish_stock = Math.floor(stocking_density * (length * width) / avg_weight);    //formula for getting the number of fishes
                  $("#display_density").val(stocking_density + " fry / sq. meter");
                  $("#display_result").val(fish_stock + " fry");
              }
              else if (compt == 2)  // if Transitional Pond is selected
              {
                  expected_timeline = 30;       //30 days until harvest
                  stocking_density = 5;         //a transitional pond can contain 5 fingerlings per squere meter
                  avg_weight = 0.07;            //a milkfish fingerling weighs an average of 70 grams

                  var fish_stock = Math.floor(stocking_density * (length * width) / avg_weight);    //formula for getting the number of fishes
                  $("#display_density").val(stocking_density + " fingerlings / sq. meter");
                  $("#display_result").val(fish_stock + " fingerlings");
              }
              else  // if Rearing Pond is selected, then show different rearing pond techniques
              {
                  expected_timeline = 120;      //120 days until harvest
                  avg_weight = 0.17;             //a juvenile milkfish in rearing ponds weighs an average of 170 grams

                  $('#apropt').on('change', function() {

                      var desc = $("#description").val();     //name of the created pond account/instance
                      var length = $("#length").val();        //length of the pond (in meters)
                      var width = $("#width").val();          //width of the pond (in meters)

                      console.log("Length: " + length);
                      console.log("Width: " + width);

                      $("#display_density").val("");
                      $("#display_result").val("");

                      var compt = this.value; 
                      if (compt == 1)    //if Common option is selected
                      {
                          $('#aprocds').on('change', function() {

                              var desc = $("#description").val();     //name of the created pond account/instance
                              var length = $("#length").val();        //length of the pond (in meters)
                              var width = $("#width").val();          //width of the pond (in meters)

                              console.log("Length: " + length);
                              console.log("Width: " + width);

                              $("#display_density").val("");
                              $("#display_result").val("");

                              var compt = this.value; 
                              if (compt == 1)   //if Extensive option is selected
                              {
                                  stocking_density = 0.2;   //an extensive rearing pond can contain 2000 fishes per hectare

                                  var fish_stock = Math.floor(stocking_density * (length * width) / avg_weight);    //formula for getting the number of fishes
                                  $("#display_density").val(stocking_density + " fish / sq. meter");
                                  $("#display_result").val(fish_stock + " fishes");
                              }
                              else if (compt == 2)    //if Modular option is selected
                              {
                                  stocking_density = 0.3;   //a modular rearing pond can contain 3000 fishes per hectare

                                  var fish_stock = Math.floor(stocking_density * (length * width) / avg_weight);    //formula for getting the number of fishes
                                  $("#display_density").val(stocking_density + " fish / sq. meter");
                                  $("#display_result").val(fish_stock + " fishes");
                              }
                              else if (compt == 3)    //if Plankton option is selected
                              {
                                  stocking_density = 0.5;   //a plankton rearing pond can contain 5000 fishes per hectare

                                  var fish_stock = Math.floor(stocking_density * (length * width) / avg_weight);    //formula for getting the number of fishes
                                  $("#display_density").val(stocking_density + " fish / sq. meter");
                                  $("#display_result").val(fish_stock + " fishes");
                              }
                              else if (compt == 4)    //if Multi-Sized Group option is selected
                              {
                                  stocking_density = 1.1;   //a multisized group rearing pond can contain 11000 fishes per hectare

                                  var fish_stock = Math.floor(stocking_density * (length * width) / avg_weight);    //formula for getting the number of fishes
                                  $("#display_density").val(stocking_density + " fish / sq. meter");
                                  $("#display_result").val(fish_stock + " fishes");
                              }
                              else if (compt == 5)    //if Semi-Intensive option is selected
                              {
                                  stocking_density = 1;   //a semi-intensive rearing pond can contain 10000 fishes per hectare

                                  var fish_stock = Math.floor(stocking_density * (length * width) / avg_weight);    //formula for getting the number of fishes
                                  $("#display_density").val(stocking_density + " fish / sq. meter");
                                  $("#display_result").val(fish_stock + " fishes");
                              }
                              else    //if Intensive option is selected
                              {
                                  stocking_density = 2.1;   //an intensive rearing pond can contain 21000 fishes per hectare

                                  var fish_stock = Math.floor(stocking_density * (length * width) / avg_weight);    //formula for getting the number of fishes
                                  $("#display_density").val(stocking_density + " fish / sq. meter");
                                  $("#display_result").val(fish_stock + " fishes");
                              }
                          });
                      }
                      else    //if Custom option is selected
                      {
                          stocking_density = 1;   //the stocking density for custom rearing pond is 1 fish per square meter

                          var fish_stock = Math.floor(stocking_density * (length * width) / avg_weight);    //formula for getting the number of fishes
                          $("#display_density").val(stocking_density + " fish / sq. meter");
                          $("#display_result").val(fish_stock + " fishes");
                      }
                  });
              }
          });

          $("#select_in_modal").on('submit', function(event){      //add pond account/instance

              var desc = $("#description").val();
              var length = $("#length").val();
              var width = $("#width").val();

              var fish_stock = Math.round((stocking_density * (length * width)) / avg_weight);

              $.ajax
              ({
                type:'post',
                url:'php/sql_add.php',
                data:{
                     function: "add_pond",
                     desc: $("#description").val(),
                     length: $("#length").val(),
                     width: $("#width").val(),
                     fish_stock: fish_stock,
                     timeline: expected_timeline,
                     user_id: localStorage.getItem("user_id")
                },
                success: function(response) 
                {    
                    if (response)
                    {
                        swal("There was an interruption!", "Pond name already exists. Please try again.", "error");
                        $('#select_in_modal').trigger("reset");
                    }
                    else
                    {
                        swal("Pond Created!", "You can now view details about your pond.", "success");
                        $('#select_in_modal').trigger("reset");
                        $(".close").click();
                    }
                }
              });

              event.preventDefault();

          });

          //code block for modal behavior (in creating pond account/instance)
          $('#apcompt').on('change', function() 
          {
              var compt = this.value; 
              if(compt == 3)
              {
                  $("#apsdn").hide();
                  $("#aproin").hide();
                  $("#apro").show();
                  $("#apropt").attr("required", true);
              }
              else
              {
                  if(!$("#apa").is(":visible"))
                  {
                      $("#apa").show();
                  }

                  $("#apro").hide();
                  $("#aprocd").hide();
                  $("#apsdn").show();
                  $("#aproin").show();
                  $("#apror").show();

                  $("#apropt").attr("required", false);
                  $("#aprocds").attr("required", false);
              }
          });

          $('#apropt').on('change', function() 
          {
              $("#apsdn").show();
              var compt = this.value; 
              if(compt == 1)
              {
                  $("#apa").show();
                  $("#aprocd").show();
                  $("#apror").show();
                  $("#aproin").hide();

                  $("#aprocds").attr("required", true);
              }
              else
              {
                  $("#apa").show();
                  $("#aprocd").hide();
                  $("#apror").show();
                  $("#aproin").show();

                  $("#aprocds").attr("required", false);
              }
          });