<?php

require 'autoload.php';

use SMSGatewayMe\Client\ApiClient;
use SMSGatewayMe\Client\Configuration;
use SMSGatewayMe\Client\Api\MessageApi;
use SMSGatewayMe\Client\Model\SendMessageRequest;

$arr = [];
$txt = $_POST["txt"];
$number = $_POST["number"];

$txt = str_replace("dC","°C", $txt);	//replace it to degrees sign 

// Configure API client
$config = Configuration::getDefaultConfiguration();
$config->setApiKey('Authorization', 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJhZG1pbiIsImlhdCI6MTUyOTI0NzAwOCwiZXhwIjo0MTAyNDQ0ODAwLCJ1aWQiOjU1MTY3LCJyb2xlcyI6WyJST0xFX1VTRVIiXX0.77rr51TSLHWa2wfOsd5Y_Unob58NQvxnpwTcKYl7FxA');
$apiClient = new ApiClient($config);
$messageClient = new MessageApi($apiClient);


	foreach($number as $id)
	{
	 	$arr[] = $id;
	}

	for ($x = 0; $x < count($arr); $x++)
	{
	 	// Sending a SMS Message
		$sendMessageRequest1 = new SendMessageRequest([
		    'phoneNumber' => $arr[$x],
		    'message' => $txt,
		    'deviceId' => 102407		//device ID of SMS Gateway App in the phone
		]);

		$sendMessages = $messageClient->sendMessages([
		    $sendMessageRequest1
		]);
	}

?>