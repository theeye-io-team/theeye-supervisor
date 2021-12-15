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

## Opciones de entorno

Modifique estas variables de entorno para cambiar el comportamiento inicial de la API. No se pueden cambiar luego de la inicialización.

* Rest API - API para interactuar con los recursos de TheEye. https://documentation.theeye.io/api/auth/

* Sistema de Monitoreo - Funciona como un proceso en segundo plano. Chequea el estado de los Monitores.

* API comandante interna (Solo escucha en el puerto 6666 en localhost) - Esta API no está documentada. Se usa solamente con propósitos de administración interna.

### Configuración de entorno

#### Configuración básica

| Nombre de la Variable        | Uso |
| ---------------------------- | --- |
| PORT                         | Cambia el puerto de la Rest API. Por defecto 60080 |
| NODE_ENV                     | El archivo del que la API debe sacar la configuración. |
| DEBUG                        | Activa/desactiva el módulo debug. [Más información](https://www.npmjs.com/package/debug) |
| THEEYE_NODE_HOSTNAME         | Extiende el módulo debug. Agrega el hostname para depurar el output y define el Hostname en contenedores Docker |
| VERSION                      | Versión de la API. Si no se provee se intentará usar la versión definida en git. |
| CONFIG_NOTIFICATIONS_API_URL | URL de destino para el sistema de notificaciones |


#### Control de componentes

Puede configurarse para una o más cosas (o ninguna)


| Nombre de la Variable   | Uso |
| ----------------------- | --- |
| COMMANDER_DISABLED      | Desactiva la API comandante interna |
| MONITORING_DISABLED     | Desactiva el monitoreo del sistema. Los monitores del sistema no van a revisarse más, solo van a actualizarse cuando los bots y agentes envíen updates |
| API_DISABLED            | Desactiva la Rest API |
| SCHEDULER_JOBS_DISABLED | Desactiva la ejecución del scheduler interno. Los jobs programados se seguiran creando usando la Rest API pero la tarea nunca se ejecutará. El timeout de la ejecución nunca se revisará. |

### Ejemplo para iniciar el desarrollo

`DEBUG=*eye* NODE_ENV=localdev MONITORING_DISABLED= SCHEDULER_JOBS_DISABLED= npx nodemon --inspect $PWD/core/main.js`
