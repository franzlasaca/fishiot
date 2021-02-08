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
	 $fname = $_POST['fname'];
	 $lname = $_POST['lname'];
	 $phonenum = $_POST['phonenum'];

	 $sql = "insert into users (email, password, fname, lname, phonenum) values ('$email', '$pass', '$fname', '$lname', '$phonenum')";
	 $insert_data = mysqli_query($conn, $sql);

	 exit();
	
?>