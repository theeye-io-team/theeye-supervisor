[![theeye.io](../../images/logo-theeye-theOeye-logo2.png)](https://theeye.io/index.html)

# Hosts API

## Rutas

 | Method | Path                                                  | Description                                | ACL       | 
 | ------ | ----------------------------------------------------- | ------------------------------------------ | --------- | 
 | GET    | /${customer}/host                                     | Listar hosts                               | viewer    | 
 | GET    | /${customer}/host/${id}                               | Obtener un host                                           | viewer    | 
 | PUT    | /${customer}/host/${id}/reconfigure                   | Enviar la orden al agente para forzar la actualización en caso de que no se haya realizado automáticamente                                           | admin     | 
 | PUT    | /host/${id}/disable                                   | Desactivación de host. Continua reportando , pero se dejan de actualizar todos los monitores. Además el agente deja de recibir Jobs.                                           | admin     | 
 | PUT    | /host/${id}/enable                                    | Activación de host                                            | admin     | 
 | PUT    | /host/${id}/fingerprints                              | Reemplaza todos los fingerprints generados por sucesivas actualizaciones del ID de conexión del agente. Se reestablece el mas actual al volver a conectar el agente.                                           | admin     | 
 | POST   | /${customer}/host/${hostname}                         | Proceso de registración de Agente versión 0                                           | agent     | 
 | POST   | /host/${hostname}                                     | Proceso de registración de Agente versión 1. Rutas sin customer name en la url                                          | agent     | 
 | POST   | /host                                                 | Proceso de registración de Agente versión 2. Rutas sin hostname en la url y generación de ID conección                                          | agent     | 

### NOTAS

* *customer* 
  
  > Puede incluirse en el cuerpo del request como `"customer"`  

* *access_token* (OBLIGATORIO)
  
  > Puede incluirse en el Authorization header \(`Authorization: Bearer ${token}`\)

  >  Puede incluirse en el query string como `access_token`

-----

## Propiedades del Modelo

 | Nombre de Propiedad | Tipo           | Descripción | 
 | ------------------- | -------------  | -----------  | 
 | disabled            | Boolean        |              | 
 | hostname            | String         |              | 
 | customer_name       | String         |              | 
 | customer_id         | Mongo ObjectID |              | 
 | fingerprints        | Array          |              | 
 | order               | Number         |              | 
 | creation_date       | Date           |              | 
 | last_update         | Date           |              | 

### Fingerprint


 | Nombre de Propiedad | Tipo          | Descripción                                                  |
 | ------------------- | ------------- | -----------                                                  |
 | fingerprint         | String        | calculated data. can be recalculated using information below |
 | platform            | String        |                                                              |
 | hostname            | String        |                                                              |
 | type                | String        |                                                              |
 | release             | String        |                                                              |
 | arch                | String        |                                                              |
 | totalmem            | String        |                                                              |
 | user                | String        |                                                              |
 | cpu                 | [ Object ]    |                                                              |
 | net                 | [ Object ]    |                                                              |
 | cwd                 | String        |                                                              |
 | agent_version       | String        |                                                              |
 | agent_username      | String        |                                                              |
 | extras              | Object        |                                                              |
 | extras.user         | Object        |                                                              |
 | extras.agent_pid    | String        |                                                              |
