<?php

	 $host = "localhost";
	 $username = "root";
	 $password = "";
	 $databasename ="fishiot";

	 $conn = mysqli_connect($host, $username, $password, $databasename);
	// Check connection
	 if (!$conn) 
	 {
		die ("Connection failed: " . mysqli_connect_error());
	 }

	 $email = $_POST['email'];
	 $pass = $_POST['password'];
	 $select_data = mysqli_query($conn, "select * from users where email = '$email' and password = '$pass'");
	 $arr = mysqli_fetch_row($select_data);

	 echo json_encode($arr);

	 exit();
	
?>