# TheEye Supervisor Core API

## ¿Qué es TheEye?

<table>
  <tr>
    <td> <img src="images/TheEye-Of-Sauron.png"></td>
    <td>
    TheEye es una plataforma de automatización de procesos desarrollada en NodeJS. Puede usarla como BPM, Rapid Backoffice Development (RDA) y nucleo de procesos.
Técnicamente, TheEye es un orquestrador. 
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

## Arquitectura

![Image of TheEye-overview](images/TheEye-core-Architect.png)

Para más información por favor revise la documentación en https://documentation.theeye.io/

## Changelog

TheEye se actualiza frecuentemente. En caso de hostear su propio entorno, es recomendable revisar periódicamente si hay actualizaciones disponibles para mantener su instalación al día con los últimos parches y features.

El changelog de TheEye se encuentra [aquí](https://github.com/theeye-io-team/theeye-changelog).

Nuestro entorno SaaS [app.theeye.io](http://app.theeye.io) está siempre al día con la última versión estable. 

Para conocer la versión de cada componentes puede consultar el dashboard web dentro de la pestaña *Help*, o hacer un GET request a las APIS. Es habitual que todos los componentes sean actualizados en cada release, por lo que es necesario verificar las versiones de todos los componentes y actualizarlos en el mismo momento ya que suelen tener dependencias entre si. 

El supervisor [`supervisor.theeye.io/api/status`](https://supervisor.theeye.io/api/status).

El Gateway [`app.theeye.io/api/status`](https://app.theeye.io/api/status).
