# Indicators API

[![theeye.io](../images/logo-theeye-theOeye-logo2.png)](https://theeye.io/en/index.html)


## API URL for Indicators

URL: `https://supervisor.theeye.io/indicator?access_token=${token}&customer=${organization_name}`

### Properties

| Name | Value | Description |
| ----- | ----- | ----- |
| title | required, unique | The name that identifies the indicator. |
| type | check available types below. | Indicator type |
| state | success,normal/failure | Status determines wether it is green\(normal/success\) or red\(failure\). |
| value | number | The factor or quantity to show.
| read\_only | true/false | When set to false the indicator can be dismissed \(deleted\) from the Dashboard. |
| acl | json array of email | users that will be able to see the indicator. Expects an array with users: \["email1","email2", ...\] |
| severity | high/low | When set to HIGH the failure status will be shown in red, otherwise it will be shown in yellow. |
| description | string | description field that is not visible in the Dashboard. |

### Types

| Type | Description |
| ----- | ----- |
| Text | The indicator value is shown as typed. value accepts strings |
| Progress | The indicator value is shown in percent inside a bar, in the same way a progress bar does. value only accepts numbers |
| Chart | Admits JSON data |
| Counter | A numeric value is shown starting at one. This indicator has special methods to increase, decrease and restart the value. value accepts only valid numbers |

| Method | Path | Description | ACL |
| ----- | ----- | ----- | ----- |
| GET   | /indicator                           | [GET All indicators from an organization](#example-1) | viewer | 
| GET   | /indicator/${id}                     | Get one                                               | viewer | 
| GET   | /indicator/title/${title}            | Get one                                               | viewer | 
| POST  | /indicator                           | [Create an Indicator](#example-2)                     | admin  | 
| PUT   | /indicator/${id}                     | Replace                                               | admin  | 
| PUT   | /indicator/title/${urlencoded_title} | Replace                                               | admin  | 
| PATCH | /indicator/${id}                     | [Update an Indicator by ID](#example-3)               | admin  | 
| PATCH | /indicator/title/${urlencoded_title} | [Update an Indicator by Title](#example-4)            | admin  | 
| PATCH | /indicator/${indicator_id}/state     | Change state or value                                 | agent  | 
| DELETE  | /indicator/${indicator_id}           | Delete             | admin  | 
| DELETE  | /indicator/title/${urlencoded_title} | [Delete indicator by title](#example-7)               | admin  | 


### Counter Indicator

| Method | Path | Description | ACL |
| ----- | ----- | ----- | ----- |
| PATCH   | /indicator/${id}/increase | Increase | agent | 
| PATCH   | /indicator/${id}/decrease | Decrease | agent | 
| PATCH   | /indicator/${id}/restart | Restart | agent | 


## Examples

#### Example 1

##### GET All indicators from an organization

Method: `GET`

URL: `https://supervisor.theeye.io/indicator?access_token=${token}&customer=${organization_name}`

*Request*
```bash
customer=$(echo $THEEYE_ORGANIZATION_NAME | jq -r '.')
token=$THEEYE_ACCESS_TOKEN

curl -X GET "https://supervisor.theeye.io/indicator?access_token=${token}&customer=${organization_name}"
```

#### Example 2 
##### Create an Indicator

Method: `POST`

Properties: `title (required, unique), type (required), state, value, acl`

Check the following example, used to create the text indicator shown at the begining of this page.

*Request*
```bash
customer=$(echo $THEEYE_ORGANIZATION_NAME | jq -r '.')
token=$THEEYE_ACCESS_TOKEN


curl -X POST "https://supervisor.theeye.io/indicator?access_token=${token}&customer=${customer}" \
--header 'Content-Type: application/json' \
--data "{\"title\":\"Currency Exchange Dollar/Peso\",\"state\":\"normal\",\"type\":\"text\",\"value\":\"37.56\",\"acl\":[\"example_user_email@theeye.io\"]}"
```

The request response will look like this, where customer\_id, customer\_name, user\_id and id values were replaced for security reasons:

*Response*
```json
{
   "enable":true,
   "acl":[
      "example_user_email@theeye.io"
   ],
   "severity":"HIGH",
   "alerts":true,
   "state":"normal",
   "sticky":false,
   "value":"37.56",
   "type":"text",
   "_type":"TextIndicator",
   "title":"Currency Exchange Dollar/Peso",
   "customer_id":"AAA",
   "customer_name":"BBB",
   "user_id":"CCC",
   "creation_date":"2018-10-22T23:10:31.912Z",
   "last_update":"2018-10-22T23:10:31.915Z",
   "id":"{indicator_id}"
}
```


#### Example 3 
##### Update an Indicator by ID

Method: `PATCH`

Properties: `title, state, value`

URL: `https://supervisor.theeye.io/indicator/${indicator_id}`

Check the following example, used to update the text indicator value shown at the begining of this page.

*Request*
```bash
customer=$(echo $THEEYE_ORGANIZATION_NAME | jq -r '.')
token=$THEEYE_ACCESS_TOKEN
indicator_id=$ID_INDICATOR

curl -X PATCH "https://supervisor.theeye.io/indicator/${indicator_id}?access_token=${token}&customer=${customer}" \
--header 'Content-Type: application/json' \
--data "{\"value\":\"59.99\"}"
```

The request response will look like this, where customer\_id, customer\_name, user\_id and id values were replaced for security reasons:

*Response*
```json
{
   "enable":true,
   "acl":[

   ],
   "severity":"HIGH",
   "alerts":true,
   "state":"normal",
   "sticky":false,
   "value":"39.96",
   "type":"text",
   "_type":"TextIndicator",
   "creation_date":"2018-10-22T23:10:31.912Z",
   "last_update":"2018-10-22T23:48:07.515Z",
   "title":"Exchange Dollar/Peso",
   "customer_id":"AAA",
   "customer_name":"BBB",
   "user_id":"CCC",
   "id":"{indicator_id}"
}
```



#### Example 4 
##### Update an Indicator by Title

Method: `PATCH`

Properties: `title, state, value`

URL: `https://supervisor.theeye.io/indicator/title/{urlencoded_title}`

Check the following example, used to update the text indicator value shown at the begining of this page.

*Request*
```bash
customer=$(echo $THEEYE_ORGANIZATION_NAME | jq -r '.')
token=$THEEYE_ACCESS_TOKEN
indicatorName=$1

curl -X PUT "https://supervisor.theeye.io/indicator/title/${indicatorName}?access_token=${token}&customer=${customer}"\
--header 'Content-Type: application/json' \
--data "{\"value\":\"15\"}"
```


#### Example 5
##### Update a Counter Indicator

Method: ****`PATCH`

Actions: `increase, decrease, restart`

URL: `https://supervisor.theeye.io/indicator/{indicator_id}/[action]`

Check the following example, used to increase the value of a counter indicator.

*Request*
```bash
customer=$(echo $THEEYE_ORGANIZATION_NAME | jq -r '.')
token=$THEEYE_ACCESS_TOKEN
indicator_id=$ID_INDICATOR

curl -X PATCH "https://supervisor.theeye.io/indicator/${indicator_id}/increase?access_token=${token}&customer=${customer}"
```
#### Example 6
##### create an indicator with admin

Method: `POST`

Properties: `title, state, value`

URL: `https://supervisor.theeye.io/indicator/${indicator_id}`

Check the following example, used to update the text indicator value shown at the begining of this page.

*Request*
```bash
customer=$(echo $THEEYE_ORGANIZATION_NAME | jq -r '.')
token=$THEEYE_ACCESS_TOKEN

curl -X POST "https://supervisor.theeye.io/indicator?access_token=${token}&customer=${customer}" \
--header 'Content-Type: application/json' \
--data "{\"title\":\"poblacion\",\"state\":\"normal\",\"type\":\"text\",\"value\":\"44millones\",\"acl\":[\"example_user@theeye.io\",\"example_viewer@theeye.io\"]}"
```

#### Example 7
##### Delete indicator by title

Method: `DELETE`

Properties: `title, state, value`

URL: `https://supervisor.theeye.io/indicator/title/${TITLE_INDICATOR}`

Check the following example, used to update the text indicator value shown at the begining of this page.

*Request*
```bash
customer=$(echo $THEEYE_ORGANIZATION_NAME | jq -r '.')
token=$THEEYE_ACCESS_TOKEN
title=$TITLE_INDICATOR

curl -X DELETE "https://supervisor.theeye.io/indicator/title/${TITLE_INDICATOR}?access_token=${token}&customer=${customer}"
```




#### More Examples

Please, check out the indicators recipe example. After importing It, fulfill the api-key and then run it, It covers the most common requirements.

Check the [Recipes Documentation](enassets/recipes/) for more details.
