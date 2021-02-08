#include <SPI.h>
#include <WiFi101.h>
#include <OneWire.h>
#include <DallasTemperature.h>

/*-----( Declare Constants )-----*/
#define ONE_WIRE_BUS 6 /*-(Connect to Pin 6)-*/
#define RELAY_ON 0
#define RELAY_OFF 1
#define hotpin 5 // Arduino Digital I/O pin numbers
#define coldpin 4
#define airpumppin 3
#define alarmpin 2

/*-----( Declare objects )-----*/
/* Set up a oneWire instance to communicate with any OneWire device*/
OneWire ourWire(ONE_WIRE_BUS);

/* Tell Dallas Temperature Library to use oneWire Library */
DallasTemperature sensors(&ourWire);

/*-----( Declare Variables )-----*/
float temperature;

String tempstats = "";    //temperature status, needed to activate water pumps on Relay
String pondstats = "";    //pond production status, needed to activate alarm on Relay

char server[] = "192.168.1.2";   //IP address of computer where the server will run

// Wi-Fi network name and password
char ssid[] = "IoT";
char pass[] = "fishiot_25";

int status = WL_IDLE_STATUS;
WiFiClient client;

void setup() /*----( SETUP: RUNS ONCE )----*/
{
  /*-(start serial port to see results )-*/
  Serial.begin(9600);

  digitalWrite(hotpin, RELAY_OFF);
  digitalWrite(coldpin, RELAY_OFF);
  digitalWrite(alarmpin, RELAY_OFF);
  digitalWrite(airpumppin, RELAY_OFF);

  pinMode (hotpin, OUTPUT);
  pinMode (coldpin, OUTPUT);
  pinMode (alarmpin, OUTPUT);
  pinMode (airpumppin, OUTPUT);

  /*-( Start up the DallasTemperature library )-*/
  sensors.begin();

  //check if the Wi-Fi unit/hotspot is attached
  Serial.println("Checking for wifi hardware...");
  if (WiFi.status() == WL_NO_SHIELD)
  {
    Serial.println("No hardware found. Quitting...");
    while (true);
  }
  Serial.println("Hardware found.");
  Serial.println();

  //attempt to connect to WiFi network:
  while (status != WL_CONNECTED)
  {
    Serial.print("Attempting to connect to: \"");
    Serial.print(ssid);
    Serial.println("\"");
    status = WiFi.begin(ssid, pass);  //initiate connection
    delay(10000);                     //wait 10 seconds for connection
  }
  Serial.println("Connected!");
  Serial.println();


}/*--(end setup )---*/


void loop() /*----( LOOP: RUNS CONSTANTLY )----*/
{
  getTemperature();
  sendData();
  analyzeTemperature();
  regulate();
  delay(1000);
  //repeat loop every second
}/* --(end main loop )-- */

void getTemperature()     //function to get temperature from sensor
{
  sensors.requestTemperatures();
  temperature = sensors.getTempCByIndex(0);   //temperature in degrees Celsius
  Serial.println(temperature);
}

void sendData() //function to send temperature data from computer via Wi-Fi hotspot connection
{
  if (client.connect(server, 10000)) //connect ip address to port 10000
  {
    Serial.println("Connected... Sending data to server...");
    client.println("GET /fishiot.com.ph/server?temp=" + String(temperature) + " HTTP/1.0");  //make HTTP GET request
    client.println();
  }
  else
  {
    Serial.println("Connection failed.");
  }

  if (client.available())   //know the description of the ip address
  {
    char c = client.read();
    Serial.print(c);
  }
  if (!client.connected())
  {
    Serial.println();
    Serial.println("Disconnecting...");
    client.stop();
    for (;;)
      ;
  }
}

void analyzeTemperature()   //function to evaluate temperature
{
  if (temperature >= 26.00 && temperature < 34.00)
  {
    tempstats = "BETTER-BESTTEMP";
    pondstats = "NORMAL";
  }
  else if ((temperature >= 24.00 && temperature < 26.00) || (temperature >= 34.00 && temperature < 36.00))
  {
    tempstats = "GOODTEMP";
    if (temperature >= 24.00 && temperature < 26.00)
    {
      pondstats = "NORMAL-COLD";
    }
    else if (temperature >= 34.00 && temperature < 36.00)
    {
      pondstats = "NORMAL-HOT";
    }
  }
  else if ((temperature >= 20.00 && temperature < 24.00) || (temperature >= 36.00 && temperature < 40.00))
  {
    tempstats = "BADTEMP";
    if (temperature >= 20.00 && temperature < 24.00)
    {
      pondstats = "WARNING1-COLD";
    }
    else if (temperature >= 36.00 && temperature < 40.00)
    {
      pondstats = "WARNING1-HOT";
    }
  }
  else if ((temperature >= 16.00 && temperature < 20.00) || (temperature >= 40.00 && temperature < 44.00))
  {
    tempstats = "WORSETEMP";
    if (temperature >= 16.00 && temperature < 20.00)
    {
      pondstats = "WARNING2-COLD";
    }
    else if (temperature >= 40.00 && temperature < 44.00)
    {
      pondstats = "WARNING2-HOT";
    }
  }
  else
  {
    tempstats = "WORSTTEMP";
    if ((temperature < 16.00))
    {
      pondstats = "CRITICAL-COLD";
    }
    else if ((temperature >= 44.00))
    {
      pondstats = "CRITICAL-HOT";
    }
  }
}

void regulate()   //function for temperature regulation component
{
  if (tempstats == "BETTER-BESTTEMP")  //halts all regulation operations since the temperature is normal
  {
    digitalWrite(hotpin, RELAY_OFF);
    digitalWrite(coldpin, RELAY_OFF);
    digitalWrite(alarmpin, RELAY_OFF);
    digitalWrite(airpumppin, RELAY_OFF);
  }
  else if (tempstats == "GOODTEMP" || tempstats == "BADTEMP" || tempstats == "WORSETEMP")  //call function to turn on the pins connected to water pumps on Relay
  {
    digitalWrite(alarmpin, RELAY_OFF);
    actions();
  }
  else if (tempstats == "WORSTTEMP") //turn on the pin that is connected to the alarm on Relay
  {
    digitalWrite(alarmpin, RELAY_ON);
    actions();    //temperature regulation is still executed
  }
}

void actions()  //function for the actual setting on of pins connected to water pumps
{
  //activate air pump and water pump that releases cold water
  if ( pondstats == "NORMAL-HOT" || pondstats == "WARNING1-HOT" || pondstats == "WARNING2-HOT" || pondstats == "CRITICAL-HOT" )
  {
    digitalWrite(coldpin, RELAY_ON);
    digitalWrite(airpumppin, RELAY_ON);
  }

  //activate water pump that releases hot water
  else if ( pondstats == "NORMAL-COLD" || pondstats == "WARNING1-COLD" || pondstats == "WARNING2-COLD" || pondstats == "CRITICAL-COLD" )
  {
    digitalWrite(hotpin, RELAY_ON);
  }
}


/* ( THE END ) */




