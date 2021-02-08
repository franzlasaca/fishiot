<?php

	date_default_timezone_set('Asia/Manila');		//set PHP time in sync to Manila time

	$host = "localhost";
	$username = "root";
	$password = "";
	$databasename ="fishiot";

	$conn = mysqli_connect($host, $username, $password, $databasename);		//establish mysql connection

	if (!$conn) 		//check if connection is successful
	{
		die ("Connection failed: " . mysqli_connect_error());
	}

	$func = $_POST["function"];

	if ($func == "get_avg_temp_per_date")	//PHP code block to get average temperature for each day (per pond and per user)
	{	
		$user_id = $_POST["user_id"];
		$pond_id = $_POST["pond_id"];
		$dir = "C:/xampp/htdocs/fishiot.com.ph/temperatures/user_".$user_id."/pond_".$pond_id;

		$records = [];
	    $records_arr = [];
	    $files = scandir($dir);		//returns array that contains date folder names
	    $arr = [];
	    $avg = 0;

	    for ($x = 2; $x < count($files); $x++)
	    {
	        $records = file_get_contents($dir."/".$files[$x]."/data.txt");
	        $records_arr = explode("\n", $records);
	        $arrlen = count($records_arr) - 1;			//total number of data contained in a text file

	        foreach($records_arr as $r)
	        {   
	            if ($r != "")		//blank spaces in text file are not included
	            {
	                $datum = explode(",", $r);
	                $avg += (float) $datum[0];			//sum of each data contained in a text file
	            }
	        }

	        $avg = $avg / $arrlen;		//get average temperature per date (per pond and per user)

	        $dateTimeSplit = explode("-", $files[$x]);	//split folder name and transform into actual date
	        $mos = $dateTimeSplit[0];
	        $dy = $dateTimeSplit[1];
	        $yr = $dateTimeSplit[2];
	        $datetxt = $dy.'-'.$mos.'-'.$yr;

	        $arr[] = [date('F d, Y', strtotime($datetxt)), round($avg, 2)];	//store date and its average temperature
	    }

	    echo json_encode($arr);		//return data when called thru Ajax
	}
	else if ($func == "pond_display")	//PHP code block to display pond account/s per user
	{
		 $txt = "";
		 $email = $_POST['email'];
		 $pass = $_POST['password'];

		 $sql = "select a.* from ponds as a 
		         left join users as b 
		         on (a.user_id = b.id)
				 where b.email = '$email' and b.password = '$pass'";

		 $select_data = mysqli_query($conn, $sql);

		 while ($arr = mysqli_fetch_assoc($select_data))
		 {
		 	$dateTimeSplit = explode(" ", $arr['date_created']);
			$date = $dateTimeSplit[0];
			$time = $dateTimeSplit[1];
			$date_started = date('M j, Y',strtotime($date));

			$dateTimeSplit = explode(" ", $arr['date_ended']);
			$date = $dateTimeSplit[0];
			$time = $dateTimeSplit[1];
			$date_ended = date('M j, Y',strtotime($date));

			$ts1 = strtotime($arr['date_created']);
			$ts2 = strtotime(date('Y-m-d H:i:s')); //current date
			$seconds_diff = $ts2 - $ts1;	//get seconds between today and the date where the pond instance was created

			$ts1 = strtotime($arr['date_created']);
			$ts2 = strtotime($arr['date_ended']); //deadline
			$total_duration = $ts2 - $ts1;	//get seconds between start date and end date

			$timeline_percentage = round(($seconds_diff / $total_duration) * 100);

		 	$txt .= '<div class="col-sm-12 col-md-6 col-lg-4" style="height: fit-content;">
                            <div class="stretch-card grid-margin shadow bg-white rounded">
                                <!-- bg-gradient-danger  bg-gradient-info-->
                                <div class="card  bg-light  card-img-holder text-dark">
                                    <div class="card-header bg-primary">
                                        <h2 class="font-weight-light mb-0 text-light mt-1">'.$arr['description'].'
                                            <i class="mdi mdi-water mdi-24px float-right"></i>
                                        </h2>
                                    </div>
                                    <div class="card-body p-3">
                                        <div class="row my-2">
                                            <div class="col-6 align-self-center">
                                                <p class="font-weight-light m-0">Fish Capacity :</p>
                                            </div>
                                            <div class="col-6 text-right align-self-center">
                                                <h4 class="font-weight-light">'.$arr['fish_stock'].'</h4>
                                            </div>
                                        </div>
                                        <div class="row my-2">
                                            <div class="col-6 align-self-center">
                                                <p class="font-weight-light m-0">Date Started :</p>
                                            </div>
                                            <div class="col-6 text-right align-self-center">
                                                <h4 class="font-weight-light">'.$date_started.'</h4>
                                            </div>
                                        </div>
                                        <div class="row my-2">
                                            <div class="col-6 align-self-center">
                                                <p class="font-weight-light m-0">Date Ended :</p>
                                            </div>
                                            <div class="col-6 text-right align-self-center">
                                                <h4 class="font-weight-light">'.$date_ended.'</h4>
                                            </div>
                                        </div>
                                        <div class="row my-2">
                                            <div class="col-6 align-self-center">
                                                <p class="font-weight-light m-0">Progress :</p>
                                            </div>
                                            <div class="col-6 text-right align-self-center">
                                                <h4 class="font-weight-light"> '.$timeline_percentage.'% </h4>
                                            </div>
                                        </div>
                                        <div class="dropdown-divider"></div>
                                        <div class="progress mt-3">
                                            <div class="progress-bar bg-primary" role="progressbar" style="width: '.$timeline_percentage.'%" aria-valuemin="0" aria-valuemax="100"></div>
                                        </div>
                                        <a href="dashboard.html" onclick="pondId('.$arr['id'].')" class="btn btn-gradient-primary mt-3 w-100 text-white">View Data</a>
                                    </div>
                                </div>
                            </div>
                        </div>';

		 }

		 echo $txt;
	}
	else if ($func == "actionlog")	//PHP code block to display system action logs in the Dashboard section of the website
	{
		 $txt = "";
		 $pond_id = $_POST["pond_id"];
		 $user_id = $_POST["user_id"];

		 $sql = "select d.temperature, e.action, a.time
				from logs as a 
				left join ponds as b 
				on (a.pond_id = b.id) 
				left join users as c 
				on (c.id = a.user_id) 
				left join temperatures as d 
				on (a.temperature_id = d.id)
				left join actions as e
				on (a.action_id = e.id)
				where c.id = '$user_id' and b.id = '$pond_id'
				order by a.id desc 
				limit 5 ";

		 $select_data = mysqli_query($conn, $sql);

		 while ($arr = mysqli_fetch_assoc($select_data))
		 {

		 	$dateTimeSplit = explode(" ", $arr['time']);
			$date = $dateTimeSplit[0];
			$time = $dateTimeSplit[1];
			$datetxt = date('F j, Y',strtotime($date))." at ".date('h:i:s A',strtotime($time));

		 	if ($arr['temperature'] == "Hot")
		 	{
		 		$txt .= '<article class="timeline-entry">
                            <div class="timeline-entry-inner">
                                <div class="timeline-icon bg-warning2">
                                    <i class="mdi mdi-exclamation mdi-24px mdi-light"></i>
                                </div>
                                <div class="timeline-label">
                                    <h2>
                                        <a>Hot</a>
                                        <span>'.$datetxt.'</span>
                                    </h2>
                                    <p>'.$arr['action'].'</p>
                                </div>
                            </div>
                        </article>';
		 	}
		 	else if ($arr['temperature'] == "Cold")
		 	{
		 		$txt .= '<article class="timeline-entry">
                            <div class="timeline-entry-inner">
                                <div class="timeline-icon bg-primary">
                                    <i class="mdi mdi-exclamation mdi-24px mdi-light"></i>
                                </div>
                                <div class="timeline-label">
                                    <h2>
                                        <a>Cold</a>
                                        <span>'.$datetxt.'</span>
                                    </h2>
                                    <p>'.$arr['action'].'</p>
                                </div>
                            </div>
                        </article>';
		 	}
		 	else if ($arr['temperature'] == "Too Hot")
		 	{
		 		$txt .= '<article class="timeline-entry">
                            <div class="timeline-entry-inner">
                                <div class="timeline-icon bg-danger">
                                    <i class="mdi mdi-block-helper mdi-24px mdi-light"></i>
                                </div>
                                <div class="timeline-label">
                                    <h2>
                                        <a>Too Hot</a>
                                        <span>'.$datetxt.'</span>
                                    </h2>
                                    <p>'.$arr['action'].'</p>
                                </div>
                            </div>
                        </article>';
		 	}
		 	else if ($arr['temperature'] == "Too Cold")
		 	{
		 		$txt .= '<article class="timeline-entry">
                            <div class="timeline-entry-inner">
                                <div class="timeline-icon bg-dark">
                                    <i class="mdi mdi-block-helper mdi-24px mdi-light"></i>
                                </div>
                                <div class="timeline-label">
                                    <h2>
                                        <a>Too Cold</a>
                                        <span>'.$datetxt.'</span>
                                    </h2>
                                    <p>'.$arr['action'].'</p>
                                </div>
                            </div>
                        </article>';
		 	}
		 	else
		 	{
		 		$txt .= '<article class="timeline-entry">
                            <div class="timeline-entry-inner">
                                <div class="timeline-icon bg-success">
                                    <i class="mdi mdi-minus mdi-24px mdi-light"></i>
                                </div>
                                <div class="timeline-label">
                                    <h2>
                                        <a>Normal</a>
                                        <span>'.$datetxt.'</span>
                                    </h2>
                                    <p>'.$arr['action'].'</p>
                                </div>
                            </div>
                        </article>';
		 	}
		 }

		 echo $txt;
	}
	else if ($func == "croplog")	//PHP code block to display the milkfishes' well-being status logs in the Dashboard section
	{
		 $txt = "";
		 $pond_id = $_POST["pond_id"];
		 $user_id = $_POST["user_id"];

		 $sql = "select d.temperature, e.status, e.information, a.time
				from logs as a 
				left join ponds as b 
				on (a.pond_id = b.id) 
				left join users as c 
				on (c.id = b.user_id) 
				left join temperatures as d 
				on (a.temperature_id = d.id)
				left join crops as e
				on (a.status_id = e.id)
				where c.id = '$user_id' and b.id = '$pond_id'
				group by d.temperature, e.status, e.information, a.time
				order by a.id desc 
				limit 4 ";

		 $select_data = mysqli_query($conn, $sql);

		 while ($arr = mysqli_fetch_assoc($select_data))
		 {

		 	$dateTimeSplit = explode(" ", $arr['time']);
			$date = $dateTimeSplit[0];
			$time = $dateTimeSplit[1];
			$datetxt = date('F j, Y',strtotime($date))." at ".date('h:i:s A',strtotime($time));

		 	if (($arr['temperature'] == "Hot") || ($arr['temperature'] == "Cold"))
		 	{
		 		$txt .= '<article class="timeline-entry">
                            <div class="timeline-entry-inner">
                                <div class="timeline-icon bg-warning">
                                    <i class="mdi mdi-fish mdi-24px mdi-light"></i>
                                </div>
                                <div class="timeline-label">
                                    <h2>
                                        <a>'.$arr['status'].'</a>
                                        <span>'.$datetxt.'</span>
                                    </h2>
                                    <p>'.$arr['information'].'</p>
                                </div>
                            </div>
                        </article>';
		 	}
		 	else if (($arr['temperature'] == "Too Hot") || ($arr['temperature'] == "Too Cold"))
		 	{
		 		$txt .= '<article class="timeline-entry">
                            <div class="timeline-entry-inner">
                                <div class="timeline-icon bg-danger">
                                    <i class="mdi mdi-fish mdi-24px mdi-light"></i>
                                </div>
                                <div class="timeline-label">
                                    <h2>
                                        <a>'.$arr['status'].'</a>
                                        <span>'.$datetxt.'</span>
                                    </h2>
                                    <p>'.$arr['information'].'</p>
                                </div>
                            </div>
                        </article>';
		 	}
		 	else
		 	{
		 		$txt .= '<article class="timeline-entry">
                            <div class="timeline-entry-inner">
                                <div class="timeline-icon bg-info">
                                    <i class="mdi mdi-fish mdi-24px mdi-light"></i>
                                </div>
                                <div class="timeline-label">
                                    <h2>
                                        <a>'.$arr['status'].'</a>
                                        <span>'.$datetxt.'</span>
                                    </h2>
                                    <p>'.$arr['information'].'</p>
                                </div>
                            </div>
                        </article>';
		 	}
		 }

		 echo $txt;
	}
	else if ($func == "get_pond_details")	//PHP code block to get the details about the accessed pond of the user
	{	
		 $row = [];
		 $pond_id = $_POST["pond_id"];
		 $user_id = $_POST["user_id"];

		 $sql = "select a.* from ponds as a 
		         left join users as b 
		         on (a.user_id = b.id)
				 where a.id = '$pond_id' and b.id = '$user_id'";

		 $select_data = mysqli_query($conn, $sql);

		 while ($arr = mysqli_fetch_assoc($select_data))
		 {
			$ts1 = strtotime($arr['date_created']);
			$ts2 = strtotime(date('Y-m-d H:i:s')); //current date
			$seconds_diff = $ts2 - $ts1;	//get seconds between today and the date where the pond instance was created

		 	$ts1 = strtotime($arr['date_created']);
			$ts2 = strtotime($arr['date_ended']); //deadline
			$total_duration = $ts2 - $ts1;	//get seconds between start date and end date

			$dateTimeSplit = explode(" ", $arr['date_ended']);
			$date = $dateTimeSplit[0];
			$time = $dateTimeSplit[1];
			$date_ended = date('F j, Y',strtotime($date));

		 	$row[] =  $arr["description"]; 									//name of pond
		 	$row[] = $total_duration - $seconds_diff;						//production timeline (how many seconds left)
		 	$row[] = $arr["fish_stock"];									//number of fishes (stocking density of the pond)
			$row[] = $arr["length"] * $arr["width"]." square meters";		//surface area of the pond
			$row[] = $date_ended;											//date of deadline of the production timeline
		 }

		 echo json_encode($row);
	}
	else if ($func == "add_pond")	//PHP code block to get the details about the accessed pond of the user
	{
		 $user_id = $_POST["user_id"];
		 $desc = $_POST["desc"];
	     $length = $_POST["length"];
	     $width = $_POST["width"];
		 $fish_stock = $_POST["fish_stock"];
		 $timeline = $_POST["timeline"];
	     $err = false;

	     //check if pond name is the same for other existing ponds (to prevent redundancy)

		 $sql = "select a.* from ponds as a 
		         left join users as b 
		         on (a.user_id = b.id)
				 where b.id = '$user_id'";

		 $select_data = mysqli_query($conn, $sql);

		 while ($arr = mysqli_fetch_assoc($select_data))
		 {
		 	if ($desc == $arr["description"])
		 	{
		 		$err = true;
		 		echo $err;
		 		break;
		 	}
		 }

		 if (!$err)
		 {
			 $sql = "insert into ponds (user_id, description, length, width, fish_stock, date_ended) 
			 		 values 
			 		 ('$user_id', '$desc', '$length', '$width', '$fish_stock', DATE_ADD(NOW(), INTERVAL '$timeline' DAY))"; 	

			 $insert_data = mysqli_query($conn, $sql);

			 echo $err;
		 }
	}
	else if ($func == "actionlog_dataTable")	//PHP code block to display the action logs in a HTML table (Action Log section)
	{
		 $rows = [];
		 $pond_id = $_POST["pond_id"];
		 $user_id = $_POST["user_id"];

		 $sql = "select a.temperature, d.action, a.time
				from logs as a 
				left join ponds as b 
				on (a.pond_id = b.id) 
				left join users as c 
				on (c.id = b.user_id) 
				left join actions as d
				on (a.action_id = d.id)
				where c.id = '$user_id' and b.id = '$pond_id'
				group by a.temperature, d.action, a.time
				order by a.id desc";

		 $select_data = mysqli_query($conn, $sql);

		 while ($arr = mysqli_fetch_assoc($select_data))
		 {	
		 	$str = $arr['temperature']." °C";
		 	$dateTimeSplit = explode(" ", $arr['time']);
			$date = $dateTimeSplit[0];
			$time = $dateTimeSplit[1];
			$datetxt = date('F j, Y',strtotime($date))." at ".date('h:i:s A',strtotime($time));

			if ($arr['temperature'] >= 24 && $arr['temperature'] < 36)
			{
				$stat = "Normal";
				if ($arr['temperature'] >= 27 && $arr['temperature'] < 33)
	            {
	                $tempstat = "Better - Best";
	            }
	            else
	            {
	                $tempstat = "Good";
	            }
			}
			else if (($arr['temperature'] >= 20 && $arr['temperature'] < 24) || ($arr['temperature'] >= 36 && $arr['temperature'] < 40))
            {
                $stat = "Warning 1";
                $tempstat = "Bad";
            }
            else if (($arr['temperature'] >= 16 && $arr['temperature'] < 20) || ($arr['temperature'] >= 40 && $arr['temperature'] < 44))
            {
                $stat = "Warning 2";
                $tempstat = "Worse";
            }
			else
			{
				$stat = "Critical";
				$tempstat = "Worst";
			}	

            $rows[] = [$str, $tempstat, $stat, $arr['action'], $datetxt, $arr['temperature'], $arr['time']];        
		 	
		 }

		 echo json_encode($rows);
	}
	else if ($func == "behaviorlog_dataTable")	//PHP code to display the milkfishes' status logs in a HTML table (Fish Behaviour section)
	{
		 $rows = [];
		 $pond_id = $_POST["pond_id"];
		 $user_id = $_POST["user_id"];

		 $sql = "select a.temperature, a.oxygen_level, e.status, a.time
				from logs as a 
				left join ponds as b 
				on (a.pond_id = b.id) 
				left join users as c 
				on (c.id = b.user_id) 
				left join temperatures as d 
				on (a.temperature_id = d.id)
				left join crops as e
				on (a.status_id = e.id)
				where c.id = '$user_id' and b.id = '$pond_id'
				group by a.temperature, a.oxygen_level, e.status, a.time
				order by a.id desc";

		 $select_data = mysqli_query($conn, $sql);

		 while ($arr = mysqli_fetch_assoc($select_data))
		 {
		 	$str = $arr['temperature']." °C";
		 	$oxy_str = $arr['oxygen_level']." mg/L";
		 	$dateTimeSplit = explode(" ", $arr['time']);
			$date = $dateTimeSplit[0];
			$time = $dateTimeSplit[1];
			$datetxt = date('F j, Y',strtotime($date))." at ".date('h:i:s A',strtotime($time));

            $rows[] = [$str, $oxy_str, $arr['status'], $datetxt, $arr['oxygen_level'], $arr['temperature'], $arr['time']];        
		 }

		 echo json_encode($rows);
	}
	else if ($func == "notificationlog")	//PHP code to display the SMS notification logs in a timeline form (Notifications section)
	{
		 $txt = "";
		 $pond_id = $_POST["pond_id"];
		 $user_id = $_POST["user_id"];

		 $sql = "select time, temperature, subject, message
				from notifications 
				where user_id = '$user_id' and pond_id = '$pond_id'
				order by id desc 
				limit 3 ";

		 $select_data = mysqli_query($conn, $sql);

		 while ($arr = mysqli_fetch_assoc($select_data))
		 {
		 	$dateTimeSplit = explode(" ", $arr['time']);
			$date = $dateTimeSplit[0];
			$time = $dateTimeSplit[1];
			$datetxt = date('F j, Y',strtotime($date))." at ".date('h:i:s A',strtotime($time));
			$msg = str_replace("dC","°C",$arr['message']);

		 	if ($arr['temperature'] < 16 || $arr['temperature'] >= 44)
		 	{
		 		$txt .= '<article class="timeline-entry">
                            <div class="timeline-entry-inner">
                                <div class="timeline-icon bg-danger">
                                    <i class="mdi mdi-comment-text mdi-24px mdi-light"></i>
                                </div>
                                <div class="timeline-label">
                                    <h2>
                                        <a>'.$arr['subject'].'</a>
                                        <p>'.$datetxt.'</p>
                                    </h2>
                                    <p class="font-weight-bold">'.$arr['temperature'].' °C</p>
                                    <p>'.$msg.'</p>
                                </div>
                            </div>
                        </article>';
		 	}
		 	else
		 	{
		 		$txt .= '<article class="timeline-entry">
                            <div class="timeline-entry-inner">
                                <div class="timeline-icon bg-warning2">
                                    <i class="mdi mdi-comment-text mdi-24px mdi-light"></i>
                                </div>
                                <div class="timeline-label">
                                    <h2>
                                        <a>'.$arr['subject'].'</a>
                                        <p>'.$datetxt.'</p>
                                    </h2>
                                    <p class="font-weight-bold">'.$arr['temperature'].' °C</p>
                                    <p>'.$msg.'</p>
                                </div>
                            </div>
                        </article>';
		 	}
		 }

		 echo $txt;
	}
	else if ($func == "notificationlog_dataTable")	//PHP code to display the SMS notification logs in a HTML form (Notifications section)
	{
		 $rows = [];
		 $txt = "";
		 $pond_id = $_POST["pond_id"];
		 $user_id = $_POST["user_id"];

		 $sql = "select time, subject, message
				from notifications
				where user_id = '$user_id' and pond_id = '$pond_id'
				group by time, subject, message
				order by id desc ";

		 $select_data = mysqli_query($conn, $sql);

		 while ($arr = mysqli_fetch_assoc($select_data))
		 {
		 	$dateTimeSplit = explode(" ", $arr['time']);
			$date = $dateTimeSplit[0];
			$time = $dateTimeSplit[1];
			$datetxt = date('F j, Y',strtotime($date))." at ".date('h:i:s A',strtotime($time));

            $rows[] = [$datetxt, $arr['subject'], $arr['message'], $arr['time']];        
		 }

		 echo json_encode($rows);
	}
	else if ($func == "add_contact")	//PHP code block to insert a new contact in the database (Contacts section)
	{
		 $user_id = $_POST["user_id"];
		 $fname = $_POST["fname"];
	     $lname = $_POST["lname"];
	     $phonenum = $_POST["phonenum"];
	     $err = false;
	     $name = $fname." ".$lname;

		 $sql = "select phonenum from users
				 where id = '$user_id'";

		 $select_data = mysqli_query($conn, $sql);

		 while ($arr = mysqli_fetch_assoc($select_data))
		 {
		 	if ($phonenum == $arr["phonenum"])	//check if contact name or number already exists in the database (to prevent redundancy)
		 	{
		 		$err = true;
		 		echo $err;
		 		break;
		 	}
		 	else
		 	{
				$sql = "select a.* from contacts as a 
			            left join users as b 
			            on (a.user_id = b.id)
			     		where b.id = '$user_id'";

				$select_data = mysqli_query($conn, $sql);

				while ($arr = mysqli_fetch_assoc($select_data))
				{
				 	if (($name == $arr["name"]) || ($phonenum == $arr["phone_number"]))
				 	{
				 		$err = true;
				 		echo $err;
				 		break;
				 	}
				}				
		 	}
		 }

		 if (!$err)
		 {
			 $sql = "insert into contacts (user_id, name, phone_number) 
				 	 values 
				 	 ('$user_id', '$name', '$phonenum')";

	     	 $insert_data = mysqli_query($conn, $sql);

			 echo $err;
		 }
	}
	else if ($func == "display_contact")	//PHP code block to display the contact logs in a HTML table (Contacts section)
	{
		 $txt = "";
		 $user_id = $_POST["user_id"];

		 $sql = "select id, name, phone_number, time
				from contacts
				where user_id = '$user_id'
				order by id desc ";

		 $select_data = mysqli_query($conn, $sql);

		 while ($arr = mysqli_fetch_assoc($select_data))
		 {
		 	$dateTimeSplit = explode(" ", $arr['time']);
			$date = $dateTimeSplit[0];
			$time = $dateTimeSplit[1];
			$datetxt = date('F j, Y',strtotime($date))." at ".date('h:i:s A',strtotime($time));

			$nameSplit = explode(" ", $arr['name']);
			$first_name = (string) $nameSplit[0];
			$last_name = (string) $nameSplit[1];
		 	
	 		$txt .= '<tr>
                        <td>'.$arr['name'].'</td>
                        <td>'.$arr['phone_number'].'</td>
                        <td>'.$datetxt.'</td>
                        <td>
                            <button class="editbutton btn btn-warning btn-sm text-light" data-toggle="modal" data-target="#edit_contact" data-firstname="'.$first_name.'" data-lastname="'.$last_name.'" data-phone="'.$arr['phone_number'].'" data-id="'.$arr['id'].'">
                            	<i class="mdi mdi-screwdriver"></i>
                            </button>
                            <button class="btn btn-danger btn-sm text-light" onclick="deleteContact('.$arr['id'].')">
                                <i class="mdi mdi-delete"></i>
                            </button>
                        </td>
                    </tr>';
		 }

		 echo $txt;
	}
	else if ($func == "get_contact_numbers")	//PHP code block to display the contact logs in a HTML table (Contacts section)
	{
		 $rows = [];
		 $user_id = $_POST["user_id"];

		 $sql = "select phone_number
				from contacts
				where user_id = '$user_id'
				order by id desc ";

		 $select_data = mysqli_query($conn, $sql);

		 while ($arr = mysqli_fetch_assoc($select_data))
		 {
		 	$rows[] = $arr['phone_number'];
		 }

		 echo json_encode($rows);
	}
	else if ($func == "history_dataTable")	//PHP code block to display the fluctuation occurence logs in a HTML table (History section)
	{
		 $rows = [];
		 $pond_id = $_POST["pond_id"];
		 $user_id = $_POST["user_id"];

		 $sql = "select b.status as condition_row, c.status as production_row, a.duration, a.time
				from fluctuations as a
				left join conditions as b
				on (a.condition_id = b.id) 
				left join productions as c
				on (a.production_id = c.id) 
				where a.user_id = '$user_id' and a.pond_id = '$pond_id'
				order by a.id desc ";

		 $select_data = mysqli_query($conn, $sql);

		 while ($arr = mysqli_fetch_assoc($select_data))
		 {
		 	$dateTimeSplit = explode(" ", $arr['time']);
			$date = $dateTimeSplit[0];
			$time = $dateTimeSplit[1];
			$datetxt = date('F j, Y',strtotime($date))." at ".date('h:i:s A',strtotime($time));

            $rows[] = [$arr['condition_row'], $arr['production_row'], $arr['duration'], $datetxt, $arr['time']];        
		 }

		 echo json_encode($rows);
	}
	else if ($func == "delete_contact")		//PHP code block to delete a contact in the database (Contacts section)
	{
		$contact_id = $_POST["contact"];

		$sql = "delete from contacts where id = '$contact_id'";
 	 	$delete_data = mysqli_query($conn, $sql);
	}
	else if ($func == "edit_contact")		//PHP code block to edit a contact in the database (Contacts section)
	{
		$user_id = $_POST["user_id"];
		$fname = $_POST["fname"];
	    $lname = $_POST["lname"];
	    $phonenum = $_POST["phonenum"];
	    $err = false;
	    $name = $fname." ".$lname;

	    $sql = "update contacts set name = '$name', phone_number = '$phonenum' where id = '$user_id'";
 	 	$update_data = mysqli_query($conn, $sql);
	}
	else if ($func == "get_latest_fluctuation_log")		//PHP code block to get the latest fluctuation log (Dashboard section)
	{
		$rows = [];
		$user_id = $_POST["user_id"];
		$pond_id = $_POST["pond_id"];

		$sql = "select duration
				from fluctuations
				where user_id = '$user_id' and pond_id = '$pond_id'
				order by id desc 
				limit 1 ";

		$select_data = mysqli_query($conn, $sql);

		while ($arr = mysqli_fetch_assoc($select_data))
	    {
		   echo $arr['duration'];
		}
	}

	exit();

?>