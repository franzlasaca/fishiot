//node modules needed for local server to work
var http = require("http");
var url = require("url");
var gun = require("gun");
var fs = require('fs');
var requester = require("request");
var mysql = require('mysql');

//set mysql database connection
var con = mysql.createConnection({
      host: "localhost",
      user: "root",
      password: "",
      database: "fishiot"
});

var online_users = []; //global list of online users

//----------------------------------------------------------------------------------------------------------------------------------------
//----------------------------------------------------------- THE SERVER -----------------------------------------------------------------
//----------------------------------------------------------------------------------------------------------------------------------------

//code block for setting up the GUN.JS ONLINE SERVER
gun = gun("https://fishiot-server.herokuapp.com/gun");

//declaration of gundb variable, reset to default values
gun.get("IoT").put({temperature: -69});
gun.get("IoT").put({previous_temperature: -69});
gun.get("user_credentials").put({number: 0, pond_id: 0, user_id: 0});

//the Node.JS local server
var server = http.createServer(function(request, response) {

    response.writeHead(200, { "Content-Type": "text/plain" });
    var params = url.parse(request.url, true).query;
    var temp = parseFloat(params.temp); 						//variable that holds current temperature

    var user_num = "";											//variable that holds user's phone number
    var pond_id = "";											//variable that holds user's pond identification
    var user_id = "";											//variable that holds user identification
    var prev_temperature = "";								    //variable that holds last recorded temperature
    
    gun.get('user_credentials').on(function(datum, id)  //get user's credentials for SMS notification sending
    { 
        user_num = datum.number;
        pond_id = datum.pond_id; 
        user_id = datum.user_id; 
    });
    
    gun.get('IoT').on(function(datum, id)   //get last recorded temperature (for preventing redundancy in SMS notification sending) 
    { 
        prev_temperature = datum.temperature; 
    });

    gun.get("IoT").put({previous_temperature: prev_temperature});
    
    console.log("Current temperature: " + temp);
    console.log("Previous temperature recorded: " + prev_temperature);
    
    if (temp == -127 || temp == -69) //if server received an output of -69 (user-default) or -127 (which means that sensor is not working or disconnected), analysis is stopped
    {
        console.log("\nError: No data recorded. Temperature sensor may not be working or is disconnected.\n");
        gun.get("IoT").put({temperature: temp});
    }
    else
    {
	    //function to add online users (in case of multiple users)
	    addUserCredentials(user_id, user_num, pond_id);

	    console.log("Online users: ");
	    console.log(online_users);

	    //for every user, fluctuation recording, add logs and text notifications are executed
	    for (var y = 0; y < online_users.length; y++)  
	    {
	        if (online_users[y][0] != 0 && online_users[y][1] != 0 && online_users[y][2] != 0)  //if user is not user-default and is 'authentic'
	        {
	            con.connect(function(err) {
	                  //get user's added contacts
	                  var sql = "SELECT phone_number FROM contacts WHERE user_id = '" + user_id + "' ORDER BY id DESC ";
	                  con.query(sql, function (err, result) 
	                  {     
	                        var phonenum = [];		//array that stores phone numbers of owner/caretaker

	                        if (!result.length)	//if no contacts to be found
	                        {
	                            phonenum.push(user_num);    //insert user's phone number only
	                        }
	                        else	//if there are contacts associated to the user
	                        {
	                            phonenum.push(user_num);    //insert user's phone number

	                            //then insert all other contacts of caretakers associated with the user
	                            var jsonData = JSON.parse(JSON.stringify(result));

	                            for (var i = 0; i < jsonData.length; i++) 
	                            {
	                                var each_contact = jsonData[i]['phone_number'];
	                                phonenum.push(each_contact);
	                            }
	                        }

                            sms_and_fluctuations(temp, prev_temperature, phonenum, pond_id, user_id);    //responsible for text notifications
                            var result = getDOlvl(temp);    //get dissolved oxygen level for brackishwater based on temperature
                            status_and_actions(prev_temperature, temp, result, pond_id, user_id);	//add action logs to the system (actions made by the IoT system)

                            gun.get("IoT").put({temperature: temp, DOlvl: result});     //store temperature and DO lvl data to gundb

                            var strTime = generateTime();   //get time (hours:minutes:seconds format) for each recorded temperature
                            var txt = temp + "," + strTime + "," + result + "\n";   //output for storage (to be used on historical chart)
                            insertToTextFile(txt, user_id, pond_id);     //create folder and text file per date; store output to text file
	                  });
	            });
	        }
	        else
	        {
	            console.log("\nError: Action log and Fluctuation recording, as well as Text notification were not initiated.\nReason: Online user and its corresponding pond credentials are not defined.\n");
	        }
	    } 
    }

}).listen(10000);   //listens for HTTP requests coming from Arduino on port 10000

//----------------------------------------------------------------------------------------------------------------------------------------
//----------------------------------------------------------- FUNCTIONS ------------------------------------------------------------------
//----------------------------------------------------------------------------------------------------------------------------------------

//global variables for fluctuation recording

var timer = 1;                   //variable that contains the fluctuation duration
var refreshIntervalId = '';      //variable that handles the fluctuation timer function
var condition_id = 0;            //variable that contains CONDITION STATUS OF THE POND
var production_id = 0;           //variable that contains PRODUCTION STATUS OF THE POND
var id_arr = [];                 //array that contains the fluctuation occurrence log

/*
    For reference purposes (based from the system's MySQL database tables):

    TEMPERATURE CONDITION STATUS -> 1 - Better - Best
                                    2 - Good
                                    3 - Bad
                                    4 - Worse
                                    5 - Worst

    POND PRODUCTION STATUS -> 1 - Normal
                              2 - Warning 1 (Hot)
                              3 - Warning 1 (Cold)
                              4 - Warning 2 (Hot)
                              5 - Warning 2 (Cold)
                              6 - Critical (Hot)
                              7 - Critical (Cold)

    ACTIONS -> 1 - Activating water pump releasing hot water
               2 - Activating water pump releasing cold water
               3 - Regulating temperature
               4 - Stopping the water pump
               5 - Activating system alarm
               6 - Monitoring temperature
               7 - Turning off the system alarm

    TEMPERATURE STATUS -> 1 - Normal
                          2 - Hot
                          3 - Cold
                          4 - Too Hot
                          5 - Too Cold

    CROP BEHAVIOR STATUS -> 1 - Stable
                            2 - Sluggish
                            3 - Stressed
*/

//general function for sending SMS notifications and Fluctuation recording as well; record them in database
function sms_and_fluctuations(temp, prev_temperature, phonenum, pond_id, user_id)
{
    if ((prev_temperature == -69 || prev_temperature == -127) || (prev_temperature >= 24 && prev_temperature < 36))    //if last recorded temperature is NORMAL, user-default or output form disconnected sensor, -> then allow sms sending once WARNING 2 and CRITICAL status is detected
    {	
    		if (prev_temperature == -69 || prev_temperature == -127)	//means that sensor is disconnected/malfunctioned, or previous temperature is user-default
		    {
		    	console.log("\nTemperature Analysis commencing...");
		    	console.log("\nSMS Notification Sending: Enabled");
		    	console.log("\nSystem Action Logs Insertion: Enabled");
		    	console.log("\nFluctuation Occurrence Recording: Enabled\n");
		    }

            if (temp >= 16 && temp < 20)    //sms sending and fluctuation recording when current temperature reaches WARNING 2 status (COLD)
            {   
                //start timer for fluctuation recording
                refreshIntervalId = setInterval(function(){ timer++; }, 1000);

                //record WARNING 2 (COLD) log for fluctuation recording
                condition_id = 4; 
                production_id = 5; 
                id_arr.push(condition_id);
                id_arr.push(production_id);

                var stat = "Normal to Warning 2 (Cold) Temperature";
                var input = "FISHIoT Advisory:\n\nWater temperature in the pond in the pond lowers down at " + temp + "dC and is now on WARNING 2 production status. Temperature regulation is ongoing, and preparation for emergency harvest is advised.";
                sendMessage(input, phonenum, pond_id, user_id, stat, temp);
            }
            else if (temp >= 40 && temp < 44)   //sms sending and fluctuation recording when current temperature reaches WARNING 2 status (HOT)
            {
                //start timer for fluctuation recording
                refreshIntervalId = setInterval(function(){ timer++; }, 1000);

                //record WARNING 2 (HOT) log for fluctuation recording
                condition_id = 4; 
                production_id = 4; 
                id_arr.push(condition_id);
                id_arr.push(production_id);

                var stat = "Normal to Warning 2 (Hot) Temperature";
                var input = "FISHIoT Advisory:\n\nWater temperature in the pond in the pond rises up at " + temp + "dC and is now on WARNING 2 production status. Temperature regulation is ongoing, and preparation for emergency harvest is advised.";
                sendMessage(input, phonenum, pond_id, user_id, stat, temp);
            }
            else if (temp < 16) //sms sending and fluctuation recording when current temperature reaches CRITICAL status (COLD)
            {   
            	//start timer for fluctuation recording
                refreshIntervalId = setInterval(function(){ timer++; }, 1000);

                //record CRITICAL (COLD) log for fluctuation recording
                condition_id = 5;  
                production_id = 7; 
                id_arr.push(condition_id);
                id_arr.push(production_id);

                var stat = "Normal to Critical (Cold) Temperature";
                var input = "FISHIoT Advisory:\n\nWater temperature in the pond quickly lowers down at " + temp + "dC and is now on CRITICAL production status. The system activated its alarm while temperature regulation is ongoing. Immediate emergency harvest is advised.";
                sendMessage(input, phonenum, pond_id, user_id, stat, temp);
            }
            else if (temp >= 44)    //sms sending and fluctuation recording when current temperature reaches CRITICAL status (HOT)
            {
                //start timer for fluctuation recording
                refreshIntervalId = setInterval(function(){ timer++; }, 1000);

                //record CRITICAL (HOT) log for fluctuation recording
                condition_id = 5;  
                production_id = 6;  
                id_arr.push(condition_id);
                id_arr.push(production_id);

                var stat = "Normal to Critical (Hot) Temperature";
                var input = "FISHIoT Advisory:\n\nWater temperature in the pond quickly rises up at " + temp + "dC and is now on CRITICAL production status. The system activated its alarm while temperature regulation is ongoing. Immediate emergency harvest is advised.";
                sendMessage(input, phonenum, pond_id, user_id, stat, temp);
            }
            else if ((temp >= 20 && temp < 24) || (temp >= 36 && temp < 40))      //fluctuation recording when current temperature reaches WARNING 1 status (HOT & COLD)
            {
                //start timer for fluctuation recording
                refreshIntervalId = setInterval(function(){ timer++; }, 1000);

                if (temp >= 20 && temp < 24) //WARNING 1 (Cold)
                {
                    condition_id = 3;  
                    production_id = 3;  
                }
                else if (temp >= 36 && temp < 40) //WARNING 1 (Hot)
                {
                    condition_id = 3;  
                    production_id = 2; 
                }

                //record WARNING 1 log for fluctuation recording
                id_arr.push(condition_id);
                id_arr.push(production_id);
            }
    }
    else if ((prev_temperature >= 20 && prev_temperature < 24) || (prev_temperature >= 36 && prev_temperature < 40))    //if last temperature recorded by the system is in WARNING 1 status, allow sms sending once WARNING 2 and CRITICAL is detected
    {
            if (temp >= 16 && temp < 20)    //sms sending when current temperature reaches WARNING 2 status (COLD)
            {   
                var stat = "Warning 1 to Warning 2 (Cold) Temperature";
                var input = "FISHIoT Advisory:\n\nWater temperature in the pond lowers down at " + temp + "dC and is now on WARNING 2 production status. Temperature regulation is ongoing, and preparation for emergency harvest is advised.";
                sendMessage(input, phonenum, pond_id, user_id, stat, temp);
            }
            else if (temp >= 40 && temp < 44)   //sms sending when current temperature reaches WARNING 2 status (HOT)
            {
                var stat = "Warning 1 to Warning 2 (Hot) Temperature";
                var input = "FISHIoT Advisory:\n\nWater temperature in the pond rises up at " + temp + "dC and is now on WARNING 2 production status. Temperature regulation is ongoing, and preparation for emergency harvest is advised.";
                sendMessage(input, phonenum, pond_id, user_id, stat, temp);
            }
            else if (temp < 16) //sms sending when current temperature reaches CRITICAL status (COLD)
            {   
                var stat = "Warning 1 to Critical (Cold) Temperature";
                var input = "FISHIoT Advisory:\n\nWater temperature in the pond quickly lowers down at " + temp + "dC and is now on CRITICAL production status. The system activated its alarm while temperature regulation is ongoing. Immediate emergency harvest is advised.";
                sendMessage(input, phonenum, pond_id, user_id, stat, temp);
            }
            else if (temp >= 44)    //sms sending when current temperature reaches CRITICAL status (HOT)
            {
                var stat = "Warning 1 to Critical (Hot) Temperature";
                var input = "FISHIoT Advisory:\n\nWater temperature in the pond quickly rises up at " + temp + "dC and is now on CRITICAL production status. The system activated its alarm while temperature regulation is ongoing. Immediate emergency harvest is advised.";
                sendMessage(input, phonenum, pond_id, user_id, stat, temp);
            }
            else if (temp >= 24 && temp < 36) //stop, record and reset timer and log array when NORMAL temperature is achieved
            {   
                if (id_arr[0] != undefined && id_arr[1] != undefined)   //checks if the array containing the fluctuation occurrence log is empty (means no log)
                {	
                    clearInterval(refreshIntervalId);
                    insert_fluctuation_occurrence(user_id, pond_id, id_arr[0], id_arr[1], timer);
                    timer = 1;
                    id_arr = [];
                }
            }
    }
    else if (prev_temperature >= 16 && prev_temperature < 20)   //if last temperature recorded by the system is in WARNING 2 status (COLD), allow sms sending once WARNING 2 and CRITICAL is detected
    {   
            if (temp < 16)      //sms sending when current temperature reaches CRITICAL status (COLD)
            {
                var stat = "Warning 2 (Cold) to Critical (Too Cold)";
                var input = "FISHIoT Advisory:\n\nWater temperature in the pond continues to lower down at " + temp + "dC and is now on CRITICAL production status. The system activated its alarm while temperature regulation is still ongoing. Immediate emergency harvest is advised.";
                sendMessage(input, phonenum, pond_id, user_id, stat, temp);
            }
            else if (temp >= 44)    //sms sending when current temperature reaches CRITICAL status (HOT)
            {
                var stat = "QUALITY ASSURANCE";
                var input = "FISHIoT Advisory:\n\nWater temperature in the pond suddenly rises up from " + prev_temperature + "dC to " + temp + "dC and is now on CRITICAL production status. Temperature sensor may be tampered or failed to function properly.";
                sendMessage(input, phonenum, pond_id, user_id, stat, temp);
            }
            else if (temp >= 40 && temp < 44)   //sms sending when current temperature reaches WARNING 2 status (HOT)
            {
                var stat = "QUALITY ASSURANCE";
                var input = "FISHIoT Advisory:\n\nWater temperature in the pond suddenly rises up from " + prev_temperature + "dC to " + temp + "dC and is now on WARNING 2 production status. Temperature sensor may be tampered or failed to function properly.";
                sendMessage(input, phonenum, pond_id, user_id, stat, temp);
            }
            else if (temp >= 24 && temp < 36) //stop, record and reset timer and log array when NORMAL temperature is achieved
            {   
                if (id_arr[0] != undefined && id_arr[1] != undefined)   //checks if the array containing the fluctuation occurrence log is empty (means no log)
                {	
                    clearInterval(refreshIntervalId);
                    insert_fluctuation_occurrence(user_id, pond_id, id_arr[0], id_arr[1], timer);
                    timer = 1;
                    id_arr = [];
                }
            }
    }
    else if (prev_temperature >= 40 && prev_temperature < 44)   //if last temperature recorded by the system is in WARNING 2 status (HOT), allow sms sending once WARNING 2 and CRITICAL is detected
    {
            if (temp < 16)     //sms sending when current temperature reaches CRITICAL status (COLD)
            {
                var stat = "QUALITY ASSURANCE";
                var input = "FISHIoT Advisory:\n\nWater temperature in the pond suddenly drops down from " + prev_temperature + "dC to " + temp + "dC and is now on CRITICAL production status. Temperature sensor may be tampered or failed to function properly.";
                sendMessage(input, phonenum, pond_id, user_id, stat, temp);
            }
            else if (temp >= 44)    //sms sending when current temperature reaches CRITICAL status (HOT)
            {
                var stat = "Warning 2 (Hot) to Critical (Too Hot)";
                var input = "FISHIoT Advisory:\n\nWater temperature in the pond continues to rise up at " + temp + "dC and is now on CRITICAL production status. The system activated its alarm while temperature regulation is still ongoing. Immediate emergency harvest is advised.";
                sendMessage(input, phonenum, pond_id, user_id, stat, temp);
            }
            else if (temp >= 16 && temp < 20)    //sms sending when current temperature reaches WARNING 2 status (COLD)
            {   
                var stat = "QUALITY ASSURANCE";
                var input = "FISHIoT Advisory:\n\nWater temperature in the pond suddenly drops down from " + prev_temperature + "dC to " + temp + "dC and is now on WARNING 2 production status. Temperature sensor may be tampered or failed to function properly.";
                sendMessage(input, phonenum, pond_id, user_id, stat, temp);
            }
            else if (temp >= 24 && temp < 36) //stop, record and reset timer and log array when NORMAL temperature is achieved
            {   
                if (id_arr[0] != undefined && id_arr[1] != undefined)   //checks if the array containing the fluctuation occurrence log is empty (means no log)
                {	
                    clearInterval(refreshIntervalId);
                    insert_fluctuation_occurrence(user_id, pond_id, id_arr[0], id_arr[1], timer);
                    timer = 1;
                    id_arr = [];
                }
            }
    }
    else if (prev_temperature < 16 && prev_temperature != -69)       //if last temperature recorded by the system is in CRITICAL status (COLD), allow sms sending once WARNING 2 and CRITICAL is detected
    {
            if (temp >= 16 && temp < 20)    //sms sending when current temperature reaches WARNING 2 status (COLD)
            {   
                var stat = "Critical (Too Cold) to Warning 2 (Cold)";
                var input = "FISHIoT Advisory:\n\nWater temperature in the pond is now under regulation and continues to rise up at " + temp + "dC, classifying it as WARNING 2 production status. System alarm has been deactivated while temperature regulation is ongoing. Preparation for emergency harvest is still advised.";
                sendMessage(input, phonenum, pond_id, user_id, stat, temp);
            }
            else if (temp >= 40 && temp < 44)   //sms sending when current temperature reaches WARNING 2 status (HOT)
            {
                var stat = "QUALITY ASSURANCE";
                var input = "FISHIoT Advisory:\n\nWater temperature in the pond suddenly rises up from " + prev_temperature + "dC to " + temp + "dC and is now on WARNING 2 production status. Temperature sensor may be tampered or failed to function properly.";
                sendMessage(input, phonenum, pond_id, user_id, stat, temp);
            }
            else if (temp >= 44)    //sms sending when current temperature reaches CRITICAL status (HOT)
            {
                var stat = "QUALITY ASSURANCE";
                var input = "FISHIoT Advisory:\n\nWater temperature in the pond suddenly rises up from " + prev_temperature + "dC to " + temp + "dC and is now on CRITICAL production status. Temperature sensor may be tampered or failed to function properly.";
                sendMessage(input, phonenum, pond_id, user_id, stat, temp);
            }
            else if (temp >= 24 && temp < 36) //stop, record and reset timer and log array when NORMAL temperature is achieved
            {   
                if (id_arr[0] != undefined && id_arr[1] != undefined)   //checks if the array containing the fluctuation occurrence log is empty (means no log)
                {
                    clearInterval(refreshIntervalId);
                    insert_fluctuation_occurrence(user_id, pond_id, id_arr[0], id_arr[1], timer);
                    timer = 1;
                    id_arr = [];
                }
            }
    }
    else if (prev_temperature >= 44)  //if last temperature recorded by the system is in CRITICAL status (HOT), allow sms sending once WARNING 2 and CRITICAL is detected
    {
            if (temp >= 16 && temp < 20)    //sms sending when current temperature reaches WARNING 2 status (COLD)
            {   
                var stat = "QUALITY ASSURANCE";
                var input = "FISHIoT Advisory:\n\nWater temperature in the pond suddenly drops down from " + prev_temperature + "dC to " + temp + "dC and is now on WARNING 2 production status. Temperature sensor may be tampered or failed to function properly.";
                sendMessage(input, phonenum, pond_id, user_id, stat, temp);
            }
            else if (temp >= 40 && temp < 44)   //sms sending when current temperature reaches WARNING 2 status (HOT)
            {
                var stat = "Critical (Too Hot) to Warning 2 (Hot)";
                var input = "FISHIoT Advisory:\n\nWater temperature in the pond is now under regulation and continues to lower down at " + temp + "dC, classifying it as WARNING 2 production status. System alarm has been deactivated while temperature regulation is ongoing. Preparation for emergency harvest is still advised.";
                sendMessage(input, phonenum, pond_id, user_id, stat, temp);
            }
            else if (temp < 16)      //sms sending when current temperature reaches CRITICAL status (COLD)
            {
                var stat = "QUALITY ASSURANCE";
                var input = "FISHIoT Advisory:\n\nWater temperature in the pond suddenly drops down from " + prev_temperature + "dC to " + temp + "dC and is now on CRITICAL production status. Temperature sensor may be tampered or failed to function properly.";
                sendMessage(input, phonenum, pond_id, user_id, stat, temp);
            }
            else if (temp >= 24 && temp < 36) //stop, record and reset timer and log array when NORMAL temperature is achieved
            {   
                if (id_arr[0] != undefined && id_arr[1] != undefined)   //checks if the array containing the fluctuation occurrence log is empty (means no log)
                {	
                    clearInterval(refreshIntervalId);
                    insert_fluctuation_occurrence(user_id, pond_id, id_arr[0], id_arr[1], timer);
                    timer = 1;
                    id_arr = [];
                }
            }
    }
}

//general function for status analysis and adding action logs when there's temperature fluctuation; record them in database
function status_and_actions(prev_temperature, temperature, do_lvl, pond_id, user_id)
{
	con.connect(function(err) { //get latest action log in mysql database as basis for current actions of the system
              var sql = "select a.temperature_id, a.condition_id from logs as a left join ponds as b on (a.pond_id = b.id) " + 
              			"left join users as c on (c.id = b.user_id) where c.id = " + user_id + " and b.id = " + pond_id + " " + 
              			"order by a.id desc limit 1 ";
              con.query(sql, function (err, response) 
              {     
              		if (!response.length || (prev_temperature <= -69 || prev_temperature <= -127))	//if mysql query returns no result or latest temperature recorded is either -127 or user-default
                    {
                        if (temperature >= 24 && temperature < 36) //if current temperature is NORMAL, hence signifies NORMAL production status
                        {
                        	var arr = []; //array which contains the ACTIONS executed by the system to regulate temperature
                            var temp = 0;   //variable that stores current TEMPERATURE STATUS
                            var temp_condition = 0;     //variable that stores CONDITION STATUS

                            if (temperature >= 26 && temperature < 34)   //current temperature is within the BETTER-BEST temperature range
                            {
                                arr = [6];
                                temp = 1;
                                temp_condition = 1;
                            }
                            else if (temperature < 26) //current temperature is below BETTER-BEST temperature range
                            {
                                arr = [1,3];
                                temp = 1;
                                temp_condition = 2;
                            }
                            else     //current temperature is above BETTER-BEST temperature range
                            {
                                arr = [2,3];
                                temp = 1;
                                temp_condition = 2;
                            }

                            var stat_id = 1;   //variable that stores CROP BEHAVIOR STATUS
                            addRecords(temperature, do_lvl, user_id, pond_id, temp, temp_condition, stat_id, arr);
                        }
                        else if ((temperature >= 16 && temperature < 24) || (temperature >= 36 && temperature < 44))  //if current temperature is WARNING, hence signifies either WARNING 1 or WARNING 2 production status
	                    {
	                    	var arr = []; //array which contains the ACTIONS executed by the system to regulate temperature
	            			var temp = 0;   //variable that stores current TEMPERATURE STATUS
                            var temp_condition = 0;     //variable that stores CONDITION STATUS

	                    	if (temperature >= 16 && temperature < 24)    //WARNING in cold temperature
				            {
				                arr = [1,3];
				                temp = 3;
                                temp_condition = 3;
				            }
				            else if (temperature >= 36 && temperature < 44) //WARNING in hot temperature
				            {
				                arr = [2,3];
				                temp = 2;
                                temp_condition = 4;
				            }

	                        var stat_id = 2;   //variable that stores CROP BEHAVIOR STATUS
	                        addRecords(temperature, do_lvl, user_id, pond_id, temp, temp_condition, stat_id, arr);
	                    }
	                    else	//current temperature is under CRITICAL status
	                    {
			            	var normalToCritical = [];    //array which contains the ACTIONS executed by the system to regulate temperature
	           				var temp = 0;   //variable that stores current TEMPERATURE STATUS
                            var temp_condition = 0;     //variable that stores CONDITION STATUS

	           				if (temperature < 16)   //CRITICAL in cold temperature
				            {
				                temp = 5;
				                normalToCritical = [1,5,3];
                                temp_condition = 5;
				            }
				            else if (temperature >= 44) //CRITICAL in hot temperature
				            {
				                temp = 4;
				                normalToCritical = [2,5,3];
                                temp_condition = 5;
				            }

				            var stat_id = 3;    //variable that stores CROP BEHAVIOR STATUS
			                addRecords(temperature, do_lvl, user_id, pond_id, temp, temp_condition, stat_id, normalToCritical);
	                    }
                    }
                    else    //if mysql query returns result which is the latest log's temperature status recorded
                    {
                    	var jsonData = JSON.parse(JSON.stringify(response));
                        var res = jsonData[0].temperature_id.toString();   //contains TEMPERATURE STATUS of the latest recorded action log
                        var res1 = jsonData[0].condition_id.toString();   //contains CONDITION STATUS of the latest recorded action log

	                    if (temperature >= 24 && temperature < 36) //if current temperature is NORMAL, hence signifies NORMAL production status
	                    {   
                            var arr = []; //array which contains the ACTIONS executed by the system to regulate temperature
                            var temp = 1;   //variable that stores current TEMPERATURE STATUS
                            var temp_condition = 1;     //variable that stores CONDITION STATUS
                            var stat_id = 1;        //variable that stores CROP BEHAVIOR STATUS

                            if (res == "1") //if latest log's temperature status is within NORMAL temperature
                            {
                                if (temperature >= 26 && temperature < 34)  //if current temperature is in BETTER-BEST status
                                {
                                    if (res1 == "2")    //if NORMAL temperature is in GOOD status
                                    {
                                        arr = [4,6];
                                    }
                                }
                                else if (temperature < 26) //current temperature is below BETTER-BEST temperature range
                                {
                                    if (res1 == "1")    //if NORMAL temperature is in BETTER-BEST status
                                    {
                                        arr = [1,3];
                                        temp_condition = 2;
                                    }
                                }
                                else  //current temperature is above BETTER-BEST temperature range
                                {
                                    if (res1 == "1")    //if NORMAL temperature is in BETTER-BEST status
                                    {
                                        arr = [2,3];
                                        temp_condition = 2;
                                    }
                                }
                            }
                            else if (res == "2" || res == "3") //if latest log's temperature status is within WARNING status
                            {
                                if (temperature >= 26 && temperature < 34)  //if current temperature is in BETTER-BEST status
                                {
                                    arr = [4,6];
                                }
                                else    //if current temperature is in GOOD status
                                {
                                    arr = [3];
                                    temp_condition = 2;
                                }
                            }
                            else     //if latest log's temperature status is within CRITICAL status
                            {
                                if (temperature >= 26 && temperature < 34)  //if current temperature is in BETTER-BEST status
                                {
                                    arr = [7,4,6];
                                }
                                else        //if current temperature is in GOOD status
                                {
                                    arr = [7,3];
                                    temp_condition = 2;
                                }
                            }

                            addRecords(temperature, do_lvl, user_id, pond_id, temp, temp_condition, stat_id, arr);
	                    }
	                    else if ((temperature >= 16 && temperature < 24) || (temperature >= 36 && temperature < 44))  //if current temperature is WARNING, hence signifies either WARNING 1 or WARNING 2 production status
	                    {
	                    	var arr = []; //array which contains the ACTIONS executed by the system to regulate temperature
                            var temp = 0;   //variable that stores current TEMPERATURE STATUS
                            var temp_condition = 0;     //variable that stores CONDITION STATUS   
                            var stat_id = 2;        //variable that stores CROP BEHAVIOR STATUS

	                    	if (temperature >= 16 && temperature < 24)    //current temperature is WARNING (COLD)
				            {
				                arr = [1,3];
				                temp = 3;
                                temp_condition = 3;
				            }
				            else  //current temperature is WARNING (HOT)
				            {
				                arr = [2,3];
				                temp = 2;
                                temp_condition = 4;
				            }

					            if (res == "1")	//if latest log's temperature status is within NORMAL temperature
			                    {    
                                    if (res1 == "2")    //if NORMAL temperature is in GOOD status
                                    {
                                        arr = [3];
                                        addRecords(temperature, do_lvl, user_id, pond_id, temp, temp_condition, stat_id, arr);
                                    }
                                    else    //if NORMAL temperature is in BETTER-BEST status
                                    {
                                        addRecords(temperature, do_lvl, user_id, pond_id, temp, temp_condition, stat_id, arr);
                                    }
			                    }
                                else if (res == "2") //if latest log's temperature status is within HOT temperature
                                {
                                      if (temperature >= 16 && temperature < 24) //if current temperature suddenly goes to WARNING (COLD) temperature
                                      {
                                          arr = [4,1,3];
                                          addRecords(temperature, do_lvl, user_id, pond_id, temp, temp_condition, stat_id, arr);
                                      }
                                }
                                else if (res == "3") //if latest log's temperature status is within COLD temperature
                                {
                                      if (temperature >= 36 && temperature < 44) //if current temperature suddenly goes to WARNING (HOT) temperature
                                      {
                                          arr = [4,2,3];
                                          addRecords(temperature, do_lvl, user_id, pond_id, temp, temp_condition, stat_id, arr);
                                      }
                                }
                                else if (res == "4") //if latest log's temperature status is within TOO HOT temperature
                                {
                                    if (temperature >= 16 && temperature < 24)   //if current temperature suddenly goes to WARNING (COLD) temperature
                                    {
                                        arr = [7,4,1,3];
                                    }
                                    else
                                    { 
                                        arr = [7,3];
                                    }

                                    addRecords(temperature, do_lvl, user_id, pond_id, temp, temp_condition, stat_id, arr);
                                }
			                    else if (res == "5") //if latest log's temperature status is within TOO COLD temperature
			                    {
			                        if (temperature >= 36 && temperature < 44)   //if current temperature suddenly goes to WARNING (HOT) temperature
			                        {
			                            arr = [7,4,2,3];
			                        }
			                        else
			                        {
			                            arr = [7,3];
			                        }

                                    addRecords(temperature, do_lvl, user_id, pond_id, temp, temp_condition, stat_id, arr);
			                    }
	                    }
	                    else	//if current temperature is CRITICAL, hence signifies CRITICAL production status
	                    {
			                var normalToCritical = [];    //array which contains the ACTIONS executed by the system to regulate temperature
                            var temp = 0;   //variable that stores current TEMPERATURE STATUS
                            var temp_condition = 0;     //variable that stores CONDITION STATUS 
                            var stat_id = 3;        //variable that stores CROP BEHAVIOR STATUS

	           				if (temperature < 16)   //if current temperature is CRITICAL (COLD)
				            {
				                temp = 5;
				                normalToCritical = [1,5,3];
                                temp_condition = 5;
				            }
				            else     //if current temperature is CRITICAL (HOT)
				            {
				                temp = 4;
				                normalToCritical = [2,5,3];
                                temp_condition = 5;
				            }
				            	if (res == "1") //if latest log's temperature status is within NORMAL temperature
			                    { 
			                        if (res1 == "2")     //if NORMAL temperature is in GOOD status
                                    {
                                        normalToCritical = [5,3];
                                        addRecords(temperature, do_lvl, user_id, pond_id, temp, temp_condition, stat_id, normalToCritical);
                                    }
                                    else        //if NORMAL temperature is in BETTER-BEST status
                                    {
                                        addRecords(temperature, do_lvl, user_id, pond_id, temp, temp_condition, stat_id, normalToCritical);
                                    }
			                    }
			                    else if (res == "2")  //if latest log's temperature status is within HOT temperature
			                    {
			                        if (temperature < 16)    //if current temperature suddenly goes to CRITICAL (COLD) temperature
			                        {
			                            normalToCritical = [5,4,1,3];
			                        }
			                        else
			                        {
			                            normalToCritical = [5,3];
			                        }

                                    addRecords(temperature, do_lvl, user_id, pond_id, temp, temp_condition, stat_id, normalToCritical);
			                    }
			                    else if (res == "3") //if latest log's temperature status is within COLD temperature
			                    {
			                        if (temperature >= 44)   //if current temperature suddenly goes to CRITICAL (HOT) temperature
			                        {
			                            normalToCritical = [5,4,2,3];
			                        }
			                        else
			                        {
			                            normalToCritical = [5,3];
			                        }

                                    addRecords(temperature, do_lvl, user_id, pond_id, temp, temp_condition, stat_id, normalToCritical);
			                    }
			                    else if (res == "4") //if latest log's temperature status is within TOO HOT temperature
			                    {
			                        if (temperature < 16)    //if current temperature suddenly goes to CRITICAL (COLD) temperature
			                        {
			                            normalToCritical = [4,1,3];
                                        addRecords(temperature, do_lvl, user_id, pond_id, temp, temp_condition, stat_id, normalToCritical);
			                        }
			                    }
			                    else if (res == "5") //if latest log's temperature status is within TOO COLD temperature
			                    {
			                        if (temperature >= 44)   //if current temperature suddenly goes to CRITICAL (HOT) temperature
			                        {
			                            normalToCritical = [4,2,3];
                                        addRecords(temperature, do_lvl, user_id, pond_id, temp, temp_condition, stat_id, normalToCritical);
			                        }
			                    }
	                    }
                    }
              });
        });
}

//specific function for storing logs to mysql database
function addRecords(temperature, do_lvl, user_id, pond_id, temperature_id, condition_id, stat_id, action_id)
{		
	con.connect(function(err) {

        var sql = "insert into logs (user_id, pond_id, temperature, oxygen_level, temperature_id, condition_id, status_id, action_id) " + 
				  "values ";
		var len = 1;  //variable storing the number of logs inserted in the database

		if (Array.isArray(action_id)) //check if action log container is an array or not
		{
			for (var x = 0; x < action_id.length; x++)
			{
				if (x == (action_id.length - 1))
			 	{
			 		sql += "('" + user_id + "', '" + pond_id + "', '" + temperature + "', '" + do_lvl + "', '" 
			 				+ temperature_id + "', '" + condition_id + "', '" + stat_id + "', '" + action_id[x] + "')";
			 	}
			 	else
			 	{
			 		sql += "('" + user_id + "', '" + pond_id + "', '" + temperature + "', '" + do_lvl + "', '" 
			 				+ temperature_id + "', '" + condition_id + "', '" + stat_id + "', '" + action_id[x] + "'),";
			 	}
			}

			len = action_id.length;
		}
		else  //if action log container is not an array (holds single action ID)
		{
			sql += "('" + user_id + "', '" + pond_id + "', '" + temperature + "', '" + do_lvl + "', '" 
			 				+ temperature_id + "', '" + condition_id + "', '" + stat_id + "', '" + action_id + "')";
		}
        
        con.query(sql, function (err, result)   //if insertion is successful, prompt message in command
        {     
      		console.log("\n" + len + " action log/s recorded.\n");
        });
        
    });
}

//specific function for sending notification in an Android-based SMS Gateway API; insert notification to mysql database
function sendMessage(input, phonenum, pond_id, user_id, stat, temp)
{
        //sends a HTTP POST request to a PHP file that sneds API calls to SMS Gateway API 
        requester.post({
                  headers: {'content-type' : 'application/x-www-form-urlencoded'},
                  url:     'http://localhost/fishiot.com.ph/php/sms_api/send.php',      //URL of the PHP file
                  form:    { txt: input, number: phonenum }     //contains phone numbers and the notification text

        }, function(error, response, body){ console.log("\nSMS Notification Message/s Sent\n"); });    //prompt message in command if successful

        var msg = input.replace("FISHIoT Advisory:\n\n", "");   //remove starting sentence in the text in preparation for database insertion

        //insert notification text message as well as other details in mysql database for storage and data presentation
        con.connect(function(err) {
              var sql = "INSERT INTO notifications (user_id, pond_id, temperature, subject, message) VALUES ('" + user_id + "', '" + pond_id + "', '" + temp + "','" + stat + "', '" + msg + "')";
              con.query(sql, function (err, result) { console.log("\n1 notification inserted.\n"); });
        });
}

//function for recording fluctuation logs in mysql database, and is responsible for adjusting the production timeline of a pond 
function insert_fluctuation_occurrence(user_id, pond_id, condition_id, production_id, duration)
{
    con.connect(function(err) {
              //insert details about the temperature fluctuation occurrence as well as its duration (in seconds) in mysql database
              var sql = "INSERT INTO fluctuations (user_id, pond_id, condition_id, production_id, duration) VALUES ('" + user_id + "', '" + pond_id + "', '" + condition_id + "','" + production_id + "', '" + duration + "')";
              con.query(sql, function (err, result) { console.log("\n1 temperature fluctuation occurrence recorded."); });

              //update/adjust production timeline deadline by adding the recorded fluctuation time in it
              var sql = "UPDATE ponds SET date_ended = DATE_ADD(date_ended, INTERVAL '" + duration + "' SECOND) WHERE user_id = '" + user_id + "' AND id = '" + pond_id + "'";
              con.query(sql, function (err, result) { console.log("Added " + duration + " seconds to production timeline.\n"); });
    });
}

//function for inserting a user and pond in the "Online Users" list, once they're in the list, they can receive notification and analysis, etc.
function addUserCredentials(user_id, user_num, pond_id)
{
    if (online_users.length == 0)  //no online users yet
    {
        online_users.push([user_id, user_num, pond_id]);
    }
    else    //if there is an online user
    {
        var exist_flag = false;

        for (var x = 0; x < online_users.length; x++)   //check if user already exists in online users array
        {
            if (user_num == online_users[x][1] && pond_id == online_users[x][2] && user_id == online_users[x][0])
            {
                exist_flag = true;
            }
        } 

        if (!exist_flag)
        {
            online_users.push([user_id, user_num, pond_id]);
            //removes default 'user' (the all-zero user)
            online_users = online_users.filter(function(item){ return item[0] != 0 && item[1] != 0 && item[2] != 0 }); 
        }
    }
}

//function for generating time when the temperature was recorded that will be stored in a text file
function generateTime()
{
    var date = new Date();
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
    return hours + ':' + minutes + ':' + seconds + ' ' + ampm;
}

//function for getting the dissolved oxygen level of the pond based on recorded temperature
function getDOlvl(temp)
{
    //formula for freshwater DO lvl
    var res1 = ((5.128205128 * Math.pow(10, -7)) * Math.pow(temp, 4)) - ((9.992229992 * Math.pow(10, -5)) * Math.pow(temp, 3)) 
                + ((8.145687646 * Math.pow(10, -3)) * Math.pow(temp, 2)) - ((4.017909868 * Math.pow(10, -1)) * temp) + 14.6048951;

    //formula for saltwater DO lvl
    var res2 = ((3.263403263 * Math.pow(10, -7)) * Math.pow(temp, 4)) - ((6.790986791 * Math.pow(10, -5)) * Math.pow(temp, 3)) 
                + ((5.763403263 * Math.pow(10, -3)) * Math.pow(temp, 2)) - ((2.913558664 * Math.pow(10, -1)) * temp) + 11.20559441;

    //average of the 2, to get brackishwater DO lvl
    var result = (res1 + res2) / 2;

    //return rounded-off dissolved oxygen level when called
    return Math.floor(result * 100) / 100;
}

//function for creating folders for users and dates of system monitoring
function insertToTextFile(txt, user_id, pond_id)
{
    var date = new Date();

    //returns date format of MM-DD-YYYY
    var folder = ("0" + (date.getMonth() + 1)).slice(-2) + "-" + ("0" + date.getDate()).slice(-2) + "-" + date.getFullYear();

    var path = "temperatures/user_" + user_id; //make folder for user

    if (!fs.existsSync(path)) //if file path doesnt exist yet in the system, then create folder & path
    {
      fs.mkdirSync(path);
    }

    path = "temperatures/user_" + user_id + "/pond_" + pond_id;   //then make folder for user's pond

    if (!fs.existsSync(path)) //if file path doesnt exist yet in the system, then create folder & path
    {
      fs.mkdirSync(path);
    }

    path = "temperatures/user_" + user_id + "/pond_" + pond_id + "/" + folder;   //then make folder for each date of monitoring in user's pond

    if (!fs.existsSync(path)) //if file path doesnt exist yet in the system, then create folder & path
    {
      fs.mkdirSync(path);
    }
    
    fs.appendFile(path + "/data.txt", txt, function (err) {});  //put data to created text file titled "data"
}
