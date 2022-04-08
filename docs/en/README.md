# TheEye Supervisor Core API

## What is TheEye?

<table>
  <tr>
    <td> <img src="images/TheEye-Of-Sauron.png"></td>
    <td> TheEye is a process automation platform developed in NodeJS. Best used as BPM, Rapid Backoffice Development (RDA) and processes' hub.
Technically TheEye is a choreographer 
    </td>
  </tr> 
</table>
<div class="container-fluid" style="text-align: center; font-family: 'Open Sans', sans-serif; width: 100%; padding-right: 15px; padding-left: 15px; margin-right: auto; margin-left: auto;">
  <div class="row" style="display: flex; flex-wrap: wrap; margin-right: -15px; margin-left: -15px;">
    <div class="col-md-12" style="flex: 0 0 50%; max-width: 50%;">
      <table>
        <th><a href="https://bit.ly/3kyybPA"; target="_blank"><img src="https://news.theeye.io/wp-content/uploads/2021/11/TheEye_redes-sociales-linkedin.png" style="width: 45%; margin: 0 auto;"></a></th>
        <th><a href="https://bit.ly/3Di5FsU"; target="_blank"><img src="https://news.theeye.io/wp-content/uploads/2021/11/TheEye_redes-sociales-grupo-rpa-copy.png" style="width: 45%; margin: 0 auto;"></a></th>
        <th><a href="https://bit.ly/3kuVqtE"; target="_blank"><img src="https://news.theeye.io/wp-content/uploads/2021/11/TheEye_redes-sociales-twitter.png" style="width: 45%; margin: 0 auto;"></a></th>
        <th><a href="https://bit.ly/31PIRTb"; target="_blank"><img src="https://news.theeye.io/wp-content/uploads/2021/11/TheEye_blog-theeye-news.png" style="width: 45%; margin: 0 auto;"></a></th>
        <th><a href="https://bit.ly/31Q7WNT"; target="_blank"><img src="https://news.theeye.io/wp-content/uploads/2021/11/TheEye_redes-sociales-instagram.png" style="width: 45%; margin: 0 auto;"></a></th>
        <th><a href="https://bit.ly/2YDFs8O"; target="_blank"><img src="https://news.theeye.io/wp-content/uploads/2021/11/TheEye_redes-sociales-youtube.png" style="width: 45%; margin: 0 auto;"></a></th>
      </table>
    </div>
  </div>
</div>

## Architecture

![Image of TheEye-overview](images/TheEye-core-Architect.png)

You can find more details about the Architecture of TheEye in the comprehensive [Documentation](https://documentation.theeye.io/theeye-supervisor/#/)


## Environment settings


Check the [quickstart](https://documentation.theeye.io/#/?id=install-all-theeye-components-on-a-single-machine) for a basic guided setup.

In the quickstart scripts and docker-compose you will find all the settings pre-defined to work locally.

You can play with it and try a different variation that fits your requirements. Pleas contact us if you need any further assistance or information.


### Predefined environment configuration


Basic configuration


| Name | Usage | Default |
| ----- | ----- | ----- |
| PORT | change rest api port. | 60080 |
| NODE_ENV | choose the configuration file that should be used. | undefined |
| DEBUG | enabled/disable the debug module. check npm debug module for more information | undefined |
| THEEYE_NODE_HOSTNAME | This key extends the debug module adding the hostname to logger output. tt is also handy to identify the docker containers logs using a hostname | undefined |
| VERSION | The current api version. If not provided will the programm will try to detected the version using git. This value could also be set using the configuration file default.js | undefined |
| CONFIG_NOTIFICATIONS_API_URL | Target notification system url. This could also be set using the configuration file default.js | undefined |


Core components control. Can be configured to do one o more things (or nothing). All the components are activated by default


| Variable Name | Usage | Default |
| ----- | ----- | ----- |
| COMMANDER_DISABLED | disable internal commander api | false |
| MONITORING_DISABLED | disable monitoring system. system monitors will not be checked anymore. will only change when bots and agents send updates | false |
| API_DISABLED | disable rest api | false |
| SCHEDULER_JOBS_DISABLED | disable internal scheduler execution. scheduler-jobs will be created using the rest api but task will never be executed. theeye-jobs execution timeout will be never checked. | false |


### Start development sample

`DEBUG=*eye* NODE_ENV=localdev MONITORING_DISABLED= SCHEDULER_JOBS_DISABLED= npx nodemon --inspect $PWD/core/main.js`
